/**
 * TrueLayer OAuth helpers.
 *
 * Handles: building the auth URL, exchanging the code, refreshing tokens.
 */
const axios  = require('axios');
const crypto = require('crypto');
const cfg    = require('./config');

/**
 * Build the TrueLayer authorisation URL.
 * `state` is a random value stored in the session to prevent CSRF.
 */
function buildAuthUrl(state) {
  const isSandbox = process.env.TRUELAYER_ENV !== 'live';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     cfg.clientId,
    redirect_uri:  cfg.redirectUri,
    scope:         cfg.scopes.join(' '),
    state,
  });
  if (isSandbox) {
    // Sandbox: include all mock/test provider groups
    params.set('providers', 'uk-cs-mock uk-ob-all uk-oauth-all');
  }
  return `${cfg.authBase}/?${params.toString()}`;
}

/** Generate a random state token for CSRF protection. */
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Exchange the one-time authorisation code for access + refresh tokens.
 * Returns { access_token, refresh_token, expires_in }.
 */
async function exchangeCode(code) {
  const response = await axios.post(`${cfg.authBase}/connect/token`, new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri:  cfg.redirectUri,
    code,
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data; // { access_token, refresh_token, expires_in, token_type }
}

/**
 * Use the refresh token to get a new access token.
 * Returns { access_token, refresh_token, expires_in }.
 * TrueLayer rotates refresh tokens on each use — always save the new one.
 */
async function refreshAccessToken(refreshToken) {
  const response = await axios.post(`${cfg.authBase}/connect/token`, new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

module.exports = { buildAuthUrl, generateState, exchangeCode, refreshAccessToken };
