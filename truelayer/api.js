/**
 * TrueLayer Data API wrappers.
 *
 * Each function accepts a live access_token (plaintext, already decrypted).
 * Errors propagate up — the caller (sync.js) handles logging.
 */
const axios = require('axios');
const cfg   = require('./config');

function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Fetch all accounts linked to this connection.
 * Returns array of account objects.
 */
async function getAccounts(accessToken) {
  const res = await axios.get(`${cfg.dataBase}/data/v1/accounts`, {
    headers: authHeader(accessToken),
  });
  return res.data.results; // [{ account_id, account_type, display_name, currency, ... }]
}

/**
 * Fetch current and available balance for a single account.
 * Returns the first balance result object.
 */
async function getBalance(accessToken, accountId) {
  const res = await axios.get(`${cfg.dataBase}/data/v1/accounts/${accountId}/balance`, {
    headers: authHeader(accessToken),
  });
  return res.data.results[0]; // { current, available, currency, update_timestamp }
}

/**
 * Fetch transactions for an account, optionally filtered by date range.
 * TrueLayer returns up to 90 days of history.
 *
 * @param {string} accessToken
 * @param {string} accountId
 * @param {string} [from]  ISO date string e.g. '2026-01-01'
 * @param {string} [to]    ISO date string e.g. '2026-03-16'
 */
async function getTransactions(accessToken, accountId, from, to) {
  const params = {};
  if (from) params.from = new Date(from).toISOString();
  if (to)   params.to   = new Date(to).toISOString();

  const res = await axios.get(
    `${cfg.dataBase}/data/v1/accounts/${accountId}/transactions`,
    { headers: authHeader(accessToken), params }
  );
  return res.data.results;
  /*
    Each transaction looks like:
    {
      transaction_id: 'txn-uuid',
      normalised_provider_transaction_id: 'provider-unique-id',
      timestamp: '2026-03-10T14:22:00Z',
      description: 'DIRECT DEBIT - UTILITIES',
      amount: -142.50,          // negative = debit/out, positive = credit/in
      currency: 'GBP',
      transaction_type: 'DEBIT' | 'CREDIT',
      transaction_category: 'BILL_PAYMENT',
      merchant_name: 'British Gas',
      running_balance: { amount: 4200.00, currency: 'GBP' },
      meta: { ... }
    }
  */
}

module.exports = { getAccounts, getBalance, getTransactions };
