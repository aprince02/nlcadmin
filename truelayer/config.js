const isSandbox = process.env.TRUELAYER_ENV !== 'live';

module.exports = {
  clientId:    process.env.TRUELAYER_CLIENT_ID,
  clientSecret: process.env.TRUELAYER_CLIENT_SECRET,
  redirectUri:  process.env.TRUELAYER_REDIRECT_URI,
  authBase: isSandbox
    ? 'https://auth.truelayer-sandbox.com'
    : 'https://auth.truelayer.com',
  dataBase: isSandbox
    ? 'https://api.truelayer-sandbox.com'
    : 'https://api.truelayer.com',
  // offline_access is required to receive a refresh token
  scopes: ['info', 'accounts', 'balance', 'transactions', 'offline_access'],
  // Restrict the bank picker to HSBC only
  providers: ['hsbc'],
  // Access tokens expire after 1 hour; refresh tokens last 90 days
  accessTokenTTLSeconds: 3600,
};
