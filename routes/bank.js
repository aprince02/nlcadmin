/**
 * Bank / TrueLayer routes.
 *
 * GET  /bank/connect          — start OAuth flow (redirect to TrueLayer)
 * GET  /bank/callback         — receive auth code from TrueLayer
 * POST /bank/sync             — manual sync trigger
 * POST /bank/disconnect       — deactivate the current connection
 * GET  /admin/bank            — admin UI page
 */
const express  = require('express');
const router   = express.Router();
const tlAuth   = require('../truelayer/auth');
const tlApi    = require('../truelayer/api');
const tlSync   = require('../truelayer/sync');
const tlDb     = require('../truelayer/dbHelper');
const { encrypt } = require('../truelayer/crypto');
const { requireLogin, checkApprovedUser } = require('../utils');

// ── Admin UI page ────────────────────────────────────────────────

router.get('/admin/bank', requireLogin, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const connection = await tlDb.getActiveConnection();
    const balance    = connection ? await tlDb.getLatestBalance(connection.account_id) : null;
    const syncLogs   = await tlDb.getRecentSyncLogs(15);
    const recentTxns = connection ? await tlDb.getRecentBankTransactions(10) : [];

    // Warn if consent expires within 7 days
    let consentWarning = false;
    if (connection?.consent_expires_at) {
      const daysLeft = Math.floor(
        (new Date(connection.consent_expires_at) - Date.now()) / 86_400_000
      );
      consentWarning = daysLeft <= 7;
    }

    res.render('bank-connection', {
      loggedInName,
      connection,
      balance,
      syncLogs,
      recentTxns,
      consentWarning,
    });
  } catch (err) {
    console.error('[Bank] Admin page error:', err);
    req.flash('error', 'Could not load bank connection details.');
    res.redirect('/admin');
  }
});

// ── Step 1: Initiate OAuth ───────────────────────────────────────

router.get('/bank/connect', requireLogin, checkApprovedUser, (req, res) => {
  const state = tlAuth.generateState();
  req.session.tlState = state;           // store for CSRF check on callback
  const url = tlAuth.buildAuthUrl(state);
  console.log('[TrueLayer] Auth URL:', url);
  res.redirect(url);
});

// ── Step 2: OAuth callback ───────────────────────────────────────

router.get('/bank/callback', requireLogin, checkApprovedUser, async (req, res) => {
  const { code, state, error } = req.query;

  // User denied consent or TrueLayer returned an error
  if (error) {
    req.flash('error', `Bank connection failed: ${error}`);
    return res.redirect('/admin/bank');
  }

  // CSRF check
  if (!state || state !== req.session.tlState) {
    req.flash('error', 'Invalid state parameter. Please try connecting again.');
    return res.redirect('/admin/bank');
  }
  delete req.session.tlState;

  try {
    // Exchange code for tokens
    const tokenData = await tlAuth.exchangeCode(code);
    const { access_token, refresh_token, expires_in } = tokenData;

    const tokenExpiresAt   = new Date(Date.now() + expires_in * 1000).toISOString();
    // UK Open Banking consent is valid for 90 days
    const consentExpiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();

    // Fetch the account list with the new token
    const accounts = await tlApi.getAccounts(access_token);
    if (!accounts || accounts.length === 0) {
      req.flash('error', 'No accounts found for this connection.');
      return res.redirect('/admin/bank');
    }

    // Use the first account (HSBC typically exposes one current account)
    const account = accounts[0];
    const accountDetails = account.account_number || {};

    await tlDb.upsertConnection({
      accountId:       account.account_id,
      accountName:     account.display_name,
      accountType:     account.account_type,
      accountNumber:   accountDetails.number  || null,
      sortCode:        accountDetails.sort_code || null,
      currency:        account.currency,
      providerId:      account.provider?.provider_id || 'hsbc',
      accessTokenEnc:  encrypt(access_token),
      refreshTokenEnc: encrypt(refresh_token),
      tokenExpiresAt,
      consentExpiresAt,
    });

    // Immediately run a first sync so the dashboard has data
    await tlSync.syncAll();

    req.flash('success', `Bank account connected: ${account.display_name}`);
    res.redirect('/admin/bank');
  } catch (err) {
    console.error('[Bank] Callback error:', err.response?.data || err.message);
    req.flash('error', 'Failed to complete bank connection. Please try again.');
    res.redirect('/admin/bank');
  }
});

// ── Manual sync ──────────────────────────────────────────────────

router.post('/bank/sync', requireLogin, checkApprovedUser, async (req, res) => {
  try {
    const result = await tlSync.syncAll();

    if (result.skipped) {
      req.flash('error', 'No active bank connection to sync.');
    } else if (result.consentExpired) {
      req.flash('error', 'Bank consent has expired. Please reconnect your account.');
    } else if (result.errors?.length) {
      req.flash('error', `Sync completed with errors: ${result.errors.join('; ')}`);
    } else {
      const inserted = result.transactions?.inserted ?? 0;
      req.flash('success', `Sync complete. ${inserted} new transaction(s) imported.`);
    }
  } catch (err) {
    console.error('[Bank] Manual sync error:', err);
    req.flash('error', 'Sync failed. Check server logs.');
  }
  res.redirect('/admin/bank');
});

// ── Disconnect ───────────────────────────────────────────────────

router.post('/bank/disconnect', requireLogin, checkApprovedUser, async (req, res) => {
  try {
    const connection = await tlDb.getActiveConnection();
    if (connection) {
      await tlDb.deactivateConnection(connection.account_id);
    }
    req.flash('success', 'Bank account disconnected. CSV import is still available.');
  } catch (err) {
    console.error('[Bank] Disconnect error:', err);
    req.flash('error', 'Could not disconnect account.');
  }
  res.redirect('/admin/bank');
});

module.exports = router;
