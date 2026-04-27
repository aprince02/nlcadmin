/**
 * SMS sender — wraps Twilio.
 *
 * Reads Twilio credentials from .env. The client is constructed lazily so the
 * server still starts in environments where Twilio isn't configured (dev / CI).
 *
 * UK number normalisation accepts the common variants treasurers actually type:
 *   07xxxxxxxxx     → +447xxxxxxxxx
 *   447xxxxxxxxx    → +447xxxxxxxxx
 *   +447xxxxxxxxx   → +447xxxxxxxxx (already E.164)
 *   00447xxxxxxxxx  → +447xxxxxxxxx
 * Anything else is rejected as invalid.
 */
const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM;

let _client = null;
function client() {
  if (!_client) {
    if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
      throw new Error('SMS not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM in .env');
    }
    _client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  }
  return _client;
}

/**
 * Normalise a UK mobile number to E.164 (+447xxxxxxxxx).
 * Returns null if the input doesn't look like a UK mobile.
 */
function normaliseUkMobile(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[\s\-()]/g, '');

  if (n.startsWith('+44')) n = n.slice(3);
  else if (n.startsWith('0044')) n = n.slice(4);
  else if (n.startsWith('44')) n = n.slice(2);
  else if (n.startsWith('0')) n = n.slice(1);

  // UK mobiles are 10 digits and start with 7
  if (!/^7\d{9}$/.test(n)) return null;
  return '+44' + n;
}

/**
 * Send the member-update SMS.
 * Returns { sent: true, sid } on success or throws.
 */
async function sendUpdateDetailsSms(phoneRaw, link, charityName) {
  const to = normaliseUkMobile(phoneRaw);
  if (!to) {
    throw new Error('Phone number is not a valid UK mobile.');
  }
  const who = charityName || 'your church';
  // Total target: <=160 GSM-7 chars to fit in one SMS segment.
  // Tokens are now 24 hex chars, so a typical link is ~73 chars; this leaves
  // ~85 chars for the body. Keep punctuation ASCII (curly quotes/em-dashes
  // count as Unicode and force the message into the 70-char UCS-2 limit).
  const body = `${who}: for accounting records, please update your details: ${link}`;

  const result = await client().messages.create({
    from: FROM_NUMBER,
    to,
    body,
  });
  return { sent: true, sid: result.sid, to };
}

module.exports = {
  normaliseUkMobile,
  sendUpdateDetailsSms,
};
