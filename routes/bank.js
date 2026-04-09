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
const { requireLogin, injectCharityId, checkApprovedUser, log } = require('../utils');

// ── Admin UI page ────────────────────────────────────────────────

router.get('/admin/bank', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const connection = await tlDb.getActiveConnection(req.charityId);
    const balance    = connection ? await tlDb.getLatestBalance(connection.account_id) : null;
    const syncLogs   = await tlDb.getRecentSyncLogs(req.charityId, 15);
    const recentTxns = connection ? await tlDb.getRecentBankTransactions(req.charityId, 10) : [];

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
    log(loggedInName + ': Error loading bank connection page - ' + err.message, req.charityId);
    req.flash('error', 'Could not load bank connection details.');
    res.redirect('/admin');
  }
});

// ── Step 1: Initiate OAuth ───────────────────────────────────────

router.get('/bank/connect', requireLogin, injectCharityId, checkApprovedUser, (req, res) => {
  const loggedInName = req.session.name;
  const state = tlAuth.generateState();
  req.session.tlState = state;
  const url = tlAuth.buildAuthUrl(state);
  log(loggedInName + ': Initiated bank connection (OAuth)', req.charityId);
  res.redirect(url);
});

// ── Step 2: OAuth callback ───────────────────────────────────────

router.get('/bank/callback', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  const { code, state, error } = req.query;

  if (error) {
    log(loggedInName + ': Bank connection denied by user - ' + error, req.charityId);
    req.flash('error', `Bank connection failed: ${error}`);
    return res.redirect('/admin/bank');
  }

  if (!state || state !== req.session.tlState) {
    log(loggedInName + ': Bank callback invalid state parameter', req.charityId);
    req.flash('error', 'Invalid state parameter. Please try connecting again.');
    return res.redirect('/admin/bank');
  }
  delete req.session.tlState;

  try {
    const tokenData = await tlAuth.exchangeCode(code);
    const { access_token, refresh_token, expires_in } = tokenData;

    const tokenExpiresAt   = new Date(Date.now() + expires_in * 1000).toISOString();
    const consentExpiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();

    const accounts = await tlApi.getAccounts(access_token);
    if (!accounts || accounts.length === 0) {
      log(loggedInName + ': Bank connection error - no accounts found', req.charityId);
      req.flash('error', 'No accounts found for this connection.');
      return res.redirect('/admin/bank');
    }

    const account = accounts[0];
    const accountDetails = account.account_number || {};

    await tlDb.upsertConnection({
      charityId:       req.charityId,
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

    await tlSync.syncAll(req.charityId);

    log(loggedInName + ': Bank account connected - ' + account.display_name, req.charityId);
    req.flash('success', `Bank account connected: ${account.display_name}`);
    res.redirect('/admin/bank');
  } catch (err) {
    log(loggedInName + ': Error completing bank connection - ' + err.message, req.charityId);
    req.flash('error', 'Failed to complete bank connection. Please try again.');
    res.redirect('/admin/bank');
  }
});

// ── Manual sync ──────────────────────────────────────────────────

router.post('/bank/sync', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const result = await tlSync.syncAll(req.charityId);

    if (result.skipped) {
      log(loggedInName + ': Bank sync skipped - no active connection', req.charityId);
      req.flash('error', 'No active bank connection to sync.');
    } else if (result.consentExpired) {
      log(loggedInName + ': Bank sync warning - consent expired, reconnection required', req.charityId);
      req.flash('error', 'Bank consent has expired. Please reconnect your account.');
    } else if (result.errors?.length) {
      log(loggedInName + ': Bank sync completed with errors - ' + result.errors.join('; '), req.charityId);
      req.flash('error', `Sync completed with errors: ${result.errors.join('; ')}`);
    } else {
      const inserted = result.transactions?.inserted ?? 0;
      log(loggedInName + ': Bank sync complete - ' + inserted + ' new transaction(s) imported', req.charityId);
      req.flash('success', `Sync complete. ${inserted} new transaction(s) imported.`);
    }
  } catch (err) {
    log(loggedInName + ': Bank sync error - ' + err.message, req.charityId);
    req.flash('error', 'Sync failed. Check server logs.');
  }
  res.redirect('/admin/bank');
});

// ── Disconnect ───────────────────────────────────────────────────

router.post('/bank/disconnect', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const connection = await tlDb.getActiveConnection(req.charityId);
    if (connection) {
      await tlDb.deactivateConnection(connection.account_id);
      log(loggedInName + ': Bank account disconnected - ' + connection.account_name, req.charityId);
    }
    req.flash('success', 'Bank account disconnected. CSV import is still available.');
  } catch (err) {
    log(loggedInName + ': Error disconnecting bank account - ' + err.message, req.charityId);
    req.flash('error', 'Could not disconnect account.');
  }
  res.redirect('/admin/bank');
});

module.exports = router;
