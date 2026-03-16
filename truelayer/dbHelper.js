/**
 * Database helpers for TrueLayer bank tables.
 * Uses the same SQLite db instance as the rest of the app.
 */
const db = require('../database');

// ── bank_connections ─────────────────────────────────────────────

function getActiveConnection() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM bank_connections WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
      (err, row) => (err ? reject(err) : resolve(row || null))
    );
  });
}

function upsertConnection({ accountId, accountName, accountType, accountNumber, sortCode,
                            currency, providerId, accessTokenEnc, refreshTokenEnc,
                            tokenExpiresAt, consentExpiresAt }) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO bank_connections
        (account_id, account_name, account_type, account_number, sort_code,
         currency, provider_id, access_token_enc, refresh_token_enc,
         token_expires_at, consent_expires_at, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(account_id) DO UPDATE SET
        account_name      = excluded.account_name,
        account_type      = excluded.account_type,
        access_token_enc  = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        token_expires_at  = excluded.token_expires_at,
        consent_expires_at= excluded.consent_expires_at,
        is_active         = 1
    `, [accountId, accountName, accountType, accountNumber, sortCode,
        currency, providerId, accessTokenEnc, refreshTokenEnc,
        tokenExpiresAt, consentExpiresAt],
    (err) => (err ? reject(err) : resolve()));
  });
}

function updateTokens(accountId, accessTokenEnc, refreshTokenEnc, tokenExpiresAt) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE bank_connections
      SET access_token_enc = ?, refresh_token_enc = ?, token_expires_at = ?
      WHERE account_id = ?
    `, [accessTokenEnc, refreshTokenEnc, tokenExpiresAt, accountId],
    (err) => (err ? reject(err) : resolve()));
  });
}

function updateLastSynced(accountId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE bank_connections SET last_synced_at = datetime('now') WHERE account_id = ?`,
      [accountId],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function deactivateConnection(accountId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE bank_connections SET is_active = 0 WHERE account_id = ?`,
      [accountId],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

// ── bank_balances ────────────────────────────────────────────────

function insertBalance(accountId, current, available, currency) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO bank_balances (account_id, current, available, currency)
      VALUES (?, ?, ?, ?)
    `, [accountId, current, available, currency],
    (err) => (err ? reject(err) : resolve()));
  });
}

function getLatestBalance(accountId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM bank_balances
      WHERE account_id = ?
      ORDER BY recorded_at DESC LIMIT 1
    `, [accountId],
    (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

// ── bank_transactions ────────────────────────────────────────────

/**
 * Insert a single bank transaction. Silently ignores duplicates
 * (provider_transaction_id is UNIQUE so the INSERT OR IGNORE handles it).
 * Returns true if a new row was inserted, false if it was a duplicate.
 */
function insertTransaction(tx) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR IGNORE INTO bank_transactions
        (account_id, provider_transaction_id, date, description,
         amount, currency, transaction_type, merchant_name, category, status, raw_payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
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
    ], function(err) {
      if (err) reject(err);
      else resolve(this.changes > 0); // true = new row, false = duplicate skipped
    });
  });
}

function getRecentBankTransactions(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM bank_transactions
      ORDER BY date DESC, imported_at DESC
      LIMIT ?
    `, [limit],
    (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// ── bank_sync_log ────────────────────────────────────────────────

function insertSyncLog({ accountId, syncType, status, recordsFetched, recordsInserted, errorMessage }) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO bank_sync_log
        (account_id, sync_type, status, records_fetched, records_inserted, error_message)
      VALUES (?,?,?,?,?,?)
    `, [accountId, syncType, status, recordsFetched || 0, recordsInserted || 0, errorMessage || null],
    (err) => (err ? reject(err) : resolve()));
  });
}

function getRecentSyncLogs(limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM bank_sync_log ORDER BY synced_at DESC LIMIT ?
    `, [limit],
    (err, rows) => (err ? reject(err) : resolve(rows)));
  });
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
  insertSyncLog,
  getRecentSyncLogs,
};
