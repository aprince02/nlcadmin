/**
 * Database helpers for TrueLayer bank tables.
 * Uses the same pg pool as the rest of the app.
 */
const pool = require('../database');

// ── bank_connections ─────────────────────────────────────────────

async function getActiveConnection() {
  const result = await pool.query(
    `SELECT * FROM bank_connections WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

async function upsertConnection({ accountId, accountName, accountType, accountNumber, sortCode,
                                  currency, providerId, accessTokenEnc, refreshTokenEnc,
                                  tokenExpiresAt, consentExpiresAt }) {
  await pool.query(`
    INSERT INTO bank_connections
      (account_id, account_name, account_type, account_number, sort_code,
       currency, provider_id, access_token_enc, refresh_token_enc,
       token_expires_at, consent_expires_at, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
    ON CONFLICT (account_id) DO UPDATE SET
      account_name       = EXCLUDED.account_name,
      account_type       = EXCLUDED.account_type,
      access_token_enc   = EXCLUDED.access_token_enc,
      refresh_token_enc  = EXCLUDED.refresh_token_enc,
      token_expires_at   = EXCLUDED.token_expires_at,
      consent_expires_at = EXCLUDED.consent_expires_at,
      is_active          = 1
  `, [accountId, accountName, accountType, accountNumber, sortCode,
      currency, providerId, accessTokenEnc, refreshTokenEnc,
      tokenExpiresAt, consentExpiresAt]);
}

async function updateTokens(accountId, accessTokenEnc, refreshTokenEnc, tokenExpiresAt) {
  await pool.query(`
    UPDATE bank_connections
    SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3
    WHERE account_id = $4
  `, [accessTokenEnc, refreshTokenEnc, tokenExpiresAt, accountId]);
}

async function updateLastSynced(accountId) {
  await pool.query(
    `UPDATE bank_connections SET last_synced_at = NOW() WHERE account_id = $1`,
    [accountId]
  );
}

async function deactivateConnection(accountId) {
  await pool.query(
    `UPDATE bank_connections SET is_active = 0 WHERE account_id = $1`,
    [accountId]
  );
}

// ── bank_balances ────────────────────────────────────────────────

async function insertBalance(accountId, current, available, currency) {
  await pool.query(`
    INSERT INTO bank_balances (account_id, current, available, currency)
    VALUES ($1, $2, $3, $4)
  `, [accountId, current, available, currency]);
}

async function getLatestBalance(accountId) {
  const result = await pool.query(`
    SELECT * FROM bank_balances
    WHERE account_id = $1
    ORDER BY recorded_at DESC LIMIT 1
  `, [accountId]);
  return result.rows[0] || null;
}

// ── bank_transactions ────────────────────────────────────────────

/**
 * Insert a single bank transaction. Silently ignores duplicates
 * (provider_transaction_id is UNIQUE). Returns true if a new row was
 * inserted, false if it was a duplicate.
 */
async function insertTransaction(tx) {
  const result = await pool.query(`
    INSERT INTO bank_transactions
      (account_id, provider_transaction_id, date, description,
       amount, currency, transaction_type, merchant_name, category, status, raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (provider_transaction_id) DO NOTHING
    RETURNING id
  `, [
    tx.accountId,
    tx.providerTransactionId,
    tx.date,
    tx.description,
    tx.amount,
    tx.currency,
    tx.transactionType,
    tx.merchantName,
    tx.category,
    tx.status,
    tx.rawPayload,
  ]);
  return result.rowCount > 0; // true = new row, false = duplicate skipped
}

async function getRecentBankTransactions(limit = 10) {
  const result = await pool.query(`
    SELECT * FROM bank_transactions
    ORDER BY date DESC, imported_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

async function getAllBankTransactions() {
  const result = await pool.query(
    `SELECT * FROM bank_transactions ORDER BY date ASC`
  );
  return result.rows;
}

// ── bank_sync_log ────────────────────────────────────────────────

async function insertSyncLog({ accountId, syncType, status, recordsFetched, recordsInserted, errorMessage }) {
  await pool.query(`
    INSERT INTO bank_sync_log
      (account_id, sync_type, status, records_fetched, records_inserted, error_message)
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [accountId, syncType, status, recordsFetched || 0, recordsInserted || 0, errorMessage || null]);
}

async function getRecentSyncLogs(limit = 20) {
  const result = await pool.query(`
    SELECT * FROM bank_sync_log ORDER BY synced_at DESC LIMIT $1
  `, [limit]);
  return result.rows;
}

module.exports = {
  getActiveConnection,
  upsertConnection,
  updateTokens,
  updateLastSynced,
  deactivateConnection,
  insertBalance,
  getLatestBalance,
  insertTransaction,
  getRecentBankTransactions,
  getAllBankTransactions,
  insertSyncLog,
  getRecentSyncLogs,
};
