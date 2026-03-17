/**
 * TrueLayer sync orchestrator.
 *
 * syncAll()  — called by the cron job and the manual "Sync Now" button.
 * Handles token refresh, balance fetch, transaction fetch, deduplication,
 * and writes a sync log entry for every run.
 */
const tlDb   = require('./dbHelper');
const mainDb = require('../dbHelper');
const api    = require('./api');
const tlAuth = require('./auth');
const { encrypt, decrypt } = require('./crypto');

/**
 * Ensure we have a valid (non-expired) access token.
 * If the token has expired, use the refresh token to get a new one
 * and persist the rotated tokens back to the database.
 *
 * Returns the plaintext access token ready to use.
 */
async function getValidAccessToken(connection) {
  const now = Date.now();
  const expiresAt = new Date(connection.token_expires_at).getTime();

  // Refresh if expired or within 2 minutes of expiry
  if (now >= expiresAt - 120_000) {
    const plainRefresh = decrypt(connection.refresh_token_enc);
    let tokenData;
    try {
      tokenData = await tlAuth.refreshAccessToken(plainRefresh);
    } catch (err) {
      // 400 / 401 here almost always means consent has expired (90-day limit)
      if (err.response?.status === 400 || err.response?.status === 401) {
        await tlDb.deactivateConnection(connection.account_id);
        throw new Error('CONSENT_EXPIRED');
      }
      throw err;
    }

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    await tlDb.updateTokens(
      connection.account_id,
      encrypt(tokenData.access_token),
      encrypt(tokenData.refresh_token),
      newExpiresAt
    );
    return tokenData.access_token;
  }

  return decrypt(connection.access_token_enc);
}

/**
 * Sync balance for one account.
 */
async function syncBalance(accessToken, accountId) {
  const balance = await api.getBalance(accessToken, accountId);
  await tlDb.insertBalance(
    accountId,
    balance.current,
    balance.available,
    balance.currency
  );
  await tlDb.insertSyncLog({
    accountId,
    syncType: 'balance',
    status: 'success',
    recordsFetched: 1,
    recordsInserted: 1,
  });
}

/**
 * Sync transactions for one account.
 * Fetches the last 30 days by default; on first sync fetches 90 days.
 * Returns { fetched, inserted } counts.
 */
async function syncTransactions(accessToken, accountId, lastSyncedAt) {
  // On first sync pull 12 months; after that pull since last sync with a 1-day buffer
  const from = lastSyncedAt
    ? new Date(new Date(lastSyncedAt).getTime() - 86_400_000).toISOString().split('T')[0]
    : new Date(Date.now() - 365 * 86_400_000).toISOString().split('T')[0];

  const rawTxns = await api.getTransactions(accessToken, accountId, from);
  let inserted = 0;

  for (const txn of rawTxns) {
    // TrueLayer provides normalised_provider_transaction_id for reliable dedup.
    // Falls back to transaction_id if not present.
    const providerTxnId = txn.normalised_provider_transaction_id || txn.transaction_id;

    const txnDate = txn.timestamp ? txn.timestamp.split('T')[0] : null;
    const isNew = await tlDb.insertTransaction({
      accountId,
      providerTransactionId: providerTxnId,
      date:              txnDate,
      description:       txn.description,
      amount:            txn.amount,         // negative = out, positive = in
      currency:          txn.currency,
      transactionType:   txn.transaction_type, // 'CREDIT' | 'DEBIT'
      merchantName:      txn.merchant_name || null,
      category:          txn.transaction_category || null,
      status:            txn.transaction_classification?.includes('pending') ? 'pending' : 'posted',
      rawPayload:        JSON.stringify(txn),
    });

    if (isNew) {
      inserted++;
      await mainDb.importBankTransaction({
        date:            txnDate,
        description:     txn.description,
        transactionType: txn.transaction_type,
        paidIn:          txn.amount > 0 ? txn.amount.toFixed(2) : null,
        paidOut:         txn.amount < 0 ? Math.abs(txn.amount).toFixed(2) : null,
        sourceRef:       `bank:${providerTxnId}`,
      });
    }
  }

  await tlDb.insertSyncLog({
    accountId,
    syncType: 'transactions',
    status: 'success',
    recordsFetched: rawTxns.length,
    recordsInserted: inserted,
  });

  return { fetched: rawTxns.length, inserted };
}

/**
 * Full sync: balance + transactions for the active connection.
 * This is what the cron job and the manual button both call.
 */
async function syncAll() {
  const connection = await tlDb.getActiveConnection();

  if (!connection) {
    console.log('[TrueLayer] No active bank connection — skipping sync.');
    return { skipped: true };
  }

  let accessToken;
  try {
    accessToken = await getValidAccessToken(connection);
  } catch (err) {
    if (err.message === 'CONSENT_EXPIRED') {
      console.warn('[TrueLayer] Consent has expired. User must re-connect.');
      await tlDb.insertSyncLog({
        accountId: connection.account_id,
        syncType: 'full',
        status: 'consent_expired',
        errorMessage: 'Open Banking consent expired. Re-authentication required.',
      });
      return { consentExpired: true };
    }
    throw err;
  }

  const result = { accountId: connection.account_id, balance: null, transactions: null, errors: [] };

  // Sync balance
  try {
    await syncBalance(accessToken, connection.account_id);
    result.balance = 'ok';
  } catch (err) {
    result.errors.push(`Balance sync failed: ${err.message}`);
    await tlDb.insertSyncLog({
      accountId: connection.account_id,
      syncType: 'balance',
      status: 'error',
      errorMessage: err.message,
    });
  }

  // Sync transactions
  try {
    const counts = await syncTransactions(accessToken, connection.account_id, connection.last_synced_at);
    result.transactions = counts;
  } catch (err) {
    result.errors.push(`Transaction sync failed: ${err.message}`);
    await tlDb.insertSyncLog({
      accountId: connection.account_id,
      syncType: 'transactions',
      status: 'error',
      errorMessage: err.message,
    });
  }

  // Backfill: ensure all bank_transactions are present in the main transactions table
  try {
    const allBankTxns = await tlDb.getAllBankTransactions();
    for (const row of allBankTxns) {
      await mainDb.importBankTransaction({
        date:            row.date,
        description:     row.description,
        transactionType: row.transaction_type,
        paidIn:          row.amount > 0 ? Math.abs(row.amount).toFixed(2) : null,
        paidOut:         row.amount < 0 ? Math.abs(row.amount).toFixed(2) : null,
        sourceRef:       `bank:${row.provider_transaction_id}`,
      });
    }
  } catch (err) {
    console.warn('[TrueLayer] Backfill warning:', err.message);
  }

  await tlDb.updateLastSynced(connection.account_id);
  console.log(`[TrueLayer] Sync complete for ${connection.account_id}:`, result);
  return result;
}

module.exports = { syncAll };
