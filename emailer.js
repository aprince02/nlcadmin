const { log } = require('console');
const fs = require('fs');
const nodemailer = require('nodemailer');

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  throw new Error('Missing SMTP credentials. Set SMTP_USER and SMTP_PASS in .env');
}

const emailConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  rateLimit: true,
  maxConnections: 1,
  maxMessages: 5,
  connectionTimeout: 10000,
  socketTimeout: 15000,
};

const sender       = `"${process.env.SMTP_FROM_NAME || 'ProBooks Accounting'}" <${process.env.SMTP_USER}>`;
const receiver     = process.env.NOTIFY_EMAIL;
const appUrl       = process.env.APP_URL || 'https://probooksaccounting.co.uk';
const brandColor   = '#1f3b5b';
const accentColor  = '#2a7fba';

const transporter = nodemailer.createTransport(emailConfig);

/** HTML-escape for interpolation into email HTML. */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Render a branded HTML email.
 *  heading    — h1 text at the top of the card
 *  intro      — short paragraph under the heading (optional)
 *  bodyHtml   — middle content (HTML, caller is responsible for escaping)
 *  cta        — { label, url } to render a button (optional)
 *  footerNote — small muted text under the body (optional)
 */
function renderEmailTemplate({ heading, intro, bodyHtml, cta, footerNote }) {
  const ctaHtml = cta
    ? `<tr><td align="center" style="padding: 8px 0 24px;">
         <a href="${esc(cta.url)}" style="background:${accentColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">${esc(cta.label)}</a>
       </td></tr>`
    : '';
  const introHtml = intro
    ? `<tr><td style="padding: 0 0 16px; color:#333; font-size:15px; line-height:1.5;">${esc(intro)}</td></tr>`
    : '';
  const bodyRow = bodyHtml
    ? `<tr><td style="padding: 0 0 8px; color:#333; font-size:15px; line-height:1.5;">${bodyHtml}</td></tr>`
    : '';
  const footerNoteHtml = footerNote
    ? `<tr><td style="padding: 16px 0 0; color:#888; font-size:13px; line-height:1.4;">${esc(footerNote)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:${brandColor};padding:20px 28px;color:#ffffff;">
                <div style="font-size:20px;font-weight:700;letter-spacing:0.3px;">ProBooks Accounting</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:22px;color:${brandColor};">${esc(heading)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${introHtml}
                  ${bodyRow}
                  ${ctaHtml}
                  ${footerNoteHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f4f6f9;padding:16px 28px;color:#888;font-size:12px;line-height:1.5;text-align:center;">
                Thank you for using our services.<br>
                If you have any questions, please reply to this email.<br>
                &copy; ${new Date().getFullYear()} Alpha Media Productions Ltd.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text fallback built from the same pieces (for clients that prefer text). */
function renderEmailText({ heading, intro, bodyText, cta, footerNote }) {
  const parts = [heading, ''];
  if (intro) parts.push(intro, '');
  if (bodyText) parts.push(bodyText, '');
  if (cta) parts.push(cta.label + ': ' + cta.url, '');
  if (footerNote) parts.push(footerNote, '');
  parts.push('—');
  parts.push('Thank you for using our services.');
  parts.push('If you have any questions, please reply to this email.');
  parts.push('© ' + new Date().getFullYear() + ' Alpha Media Productions Ltd.');
  return parts.join('\n');
}

/** Build a common mail message with branded HTML + text. Always includes the inline logo. */
function buildMail({ to, subject, heading, intro, bodyHtml, bodyText, cta, footerNote, attachments }) {
  return {
    from: sender,
    to,
    subject,
    text: renderEmailText({ heading, intro, bodyText, cta, footerNote }),
    html: renderEmailTemplate({ heading, intro, bodyHtml, cta, footerNote }),
    attachments,
  };
}

async function createAndEmail(fileType, subject, message) {
  const fileName = `${fileType}.csv`;
  const backupFilename = `${fileType}_backup.csv`;
  fs.copyFileSync(fileName, backupFilename);

  const mailOptions = buildMail({
    to: receiver,
    subject,
    heading: subject,
    intro: `Please find attached the ${message}.`,
    bodyText: `Please find attached the ${message}.`,
    attachments: [{ filename: backupFilename, path: backupFilename }],
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!', info.response);
  } catch (error) {
    console.error('Error sending email: ', error);
  }
  fs.unlinkSync(backupFilename);
  fs.unlinkSync(fileName);
}

async function sendStatementByEmail(pdfPath, toEmail) {
  const mailOptions = buildMail({
    to: toEmail || receiver,
    subject: 'Statement of Donations',
    heading: 'Statement of Donations',
    intro: 'Please find attached your statement of donations.',
    bodyText: 'Please find attached your statement of donations.',
    attachments: [{ filename: pdfPath, path: `./${pdfPath}` }],
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    log('Statement sent: ' + pdfPath + info.response);
    fs.unlinkSync(pdfPath);
  } catch (error) {
    log("'Error sending email: " + error);
  }
}

async function sendDonorStatementBuffer(toEmail, pdfBuffer, donorName) {
  const mailOptions = buildMail({
    to: toEmail,
    subject: `Statement of Donations — ${donorName}`,
    heading: 'Statement of Donations',
    intro: `Please find attached the statement of donations for ${donorName}.`,
    bodyText: `Please find attached the statement of donations for ${donorName}.`,
    attachments: [
      { filename: `${donorName} - Statement of Donations.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  });
  const info = await transporter.sendMail(mailOptions);
  log('Donor statement emailed to ' + toEmail + ': ' + info.response);
}

async function sendTransactionsEmail(pdfPath, receiverEmail) {
  const mailOptions = buildMail({
    to: receiverEmail,
    subject: 'Statement of Transactions',
    heading: 'Statement of Transactions',
    intro: 'As requested, please find attached the statement of transactions.',
    bodyText: 'As requested, please find attached the statement of transactions.',
    attachments: [{ filename: pdfPath, path: `./${pdfPath}` }],
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    log('Transactions email sent: ' + pdfPath + info.response);
    fs.unlinkSync(pdfPath);
  } catch (error) {
    log("'Error sending email: " + error);
  }
}

async function createAndEmailDBBackup() {
  const dbFilename = 'db.sqlite';
  const backupFilename = 'db_backup.sqlite';
  fs.copyFileSync(dbFilename, backupFilename);

  const mailOptions = buildMail({
    to: receiver,
    subject: 'ProBooks Accounting - Database Backup',
    heading: 'Database Backup',
    intro: 'Please find attached the database backup.',
    bodyText: 'Please find attached the database backup.',
    attachments: [{ filename: backupFilename, path: backupFilename }],
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
  fs.unlinkSync(backupFilename);
}

async function emailMemberForUpdate(row, charityName, token) {
  const link  = `${appUrl}/update-details/${token}`;
  const who   = charityName || 'your church';
  const intro = `Dear ${row.first_name} ${row.surname},`;

  const mailOptions = buildMail({
    to: row.email,
    subject: 'Update your member details',
    heading: 'Please check your details',
    intro,
    bodyHtml: `Please click the button below to check the details stored by <strong>${esc(who)}</strong>, and update anything that is not correct.`,
    bodyText: `Please follow the link below to check the details stored by ${who}, and update anything that is not correct.`,
    cta: { label: 'Update my details', url: link },
    footerNote: 'This link expires in 14 days and can only be used once. If you did not expect this email, please ignore it.',
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function sendNewUserAddedEmail(user, notifyEmail) {
  const mailOptions = buildMail({
    to: notifyEmail || receiver,
    subject: 'New User Added',
    heading: 'New User Added',
    intro: `${user} has been added.`,
    bodyText: `${user} has been added.`,
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    log('New user email sent:' + ' ' + info.response);
  } catch (error) {
    log("'Error sending email: " + error);
  }
}

async function sendDonationReceivedEmail(member, donation, charityName) {
  const who = charityName || 'your church';
  const detailsRow = (label, value) => `
    <tr>
      <td style="padding:6px 12px;background:#f4f6f9;color:#555;font-size:13px;">${esc(label)}</td>
      <td style="padding:6px 12px;font-size:14px;color:#222;">${esc(value)}</td>
    </tr>`;
  const detailsTable = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;width:100%;max-width:420px;">
      ${detailsRow('Amount', '£' + donation.amount)}
      ${detailsRow('Fund', donation.fund)}
      ${detailsRow('Date', donation.date)}
    </table>`;

  const verse = '"Let each man give according as he has determined in his heart, not grudgingly or under compulsion, for God loves a cheerful giver." — 2 Corinthians 9:7';

  const mailOptions = buildMail({
    to: member.email,
    subject: 'Your donation to ' + who,
    heading: 'Thank you for your donation',
    intro: `Dear ${member.first_name} ${member.surname}, your donation to ${who} has been acknowledged by the treasurer.`,
    bodyHtml: detailsTable + `<p style="margin:16px 0 0;font-style:italic;color:#555;">${esc(verse)}</p>`,
    bodyText: `Amount: £${donation.amount}\nFund: ${donation.fund}\nDate: ${donation.date}\n\n${verse}`,
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    log('New donation email sent to: ' + member.email + ' ' + info.response);
  } catch (error) {
    log("'Error sending email: " + error);
  }
}

async function sendTransactionsPDFBuffer(to, pdfBuffer, pdfFilename) {
  const mailOptions = buildMail({
    to,
    subject: 'ProBooks Accounting - Transactions Export',
    heading: 'Transactions Export',
    intro: 'Please find attached the transactions export PDF.',
    bodyText: 'Please find attached the transactions export PDF.',
    attachments: [
      { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  });
  const info = await transporter.sendMail(mailOptions);
  console.log('Transactions PDF email sent:', info.response);
}

async function sendDonationsPDFBuffer(to, pdfBuffer, pdfFilename) {
  const mailOptions = buildMail({
    to,
    subject: 'ProBooks Accounting - Donations Export',
    heading: 'Donations Export',
    intro: 'Please find attached the donations export PDF.',
    bodyText: 'Please find attached the donations export PDF.',
    attachments: [
      { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  });
  const info = await transporter.sendMail(mailOptions);
  console.log('Donations PDF email sent:', info.response);
}

async function sendTotalsExportEmail(to, csvBuffer, pdfBuffer, csvFilename, pdfFilename) {
  const mailOptions = buildMail({
    to,
    subject: 'ProBooks Accounting - Totals Export',
    heading: 'Totals Export',
    intro: 'Please find attached the totals export as both a CSV and a PDF file.',
    bodyText: 'Please find attached the totals export as both a CSV and a PDF file.',
    attachments: [
      { filename: csvFilename, content: csvBuffer, contentType: 'text/csv' },
      { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  });
  const info = await transporter.sendMail(mailOptions);
  console.log('Totals export email sent:', info.response);
}

async function sendInviteEmail(email, token, role, charityName) {
  const inviteUrl = `${appUrl}/invite/${token}`;
  const mailOptions = buildMail({
    to: email,
    subject: `You've been invited to ProBooks Accounting`,
    heading: 'You have been invited',
    intro: `You have been invited to join ${charityName} on ProBooks Accounting as a ${role}.`,
    bodyHtml: `Click the button below to accept your invitation.`,
    bodyText: `You have been invited to join ${charityName} on ProBooks Accounting as a ${role}.`,
    cta: { label: 'Accept invitation', url: inviteUrl },
    footerNote: 'This link expires in 48 hours. If you did not expect this invitation, please ignore this email.',
  });
  // One-shot transporter so the shared pool state doesn't block delivery
  const oneShot = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
  });
  try {
    const info = await oneShot.sendMail(mailOptions);
    console.log('[Invite] Email sent to', email, ':', info.response);
  } finally {
    oneShot.close();
  }
}

async function sendPaymentFailedEmail(to, charityName, billingUrl) {
  const mailOptions = buildMail({
    to,
    subject: `Payment failed for ${charityName}`,
    heading: 'Action needed: payment failed',
    intro: `We were unable to process the latest subscription payment for ${charityName}.`,
    bodyHtml: 'To keep your account active, please update your payment method in the billing portal. If the issue is not resolved, your subscription will be cancelled and access to ProBooks Accounting will be blocked.',
    bodyText: 'To keep your account active, please update your payment method. If the issue is not resolved, your subscription will be cancelled and access will be blocked.',
    cta: { label: 'Update payment method', url: billingUrl },
    footerNote: 'You will continue to receive this reminder daily until the issue is resolved.',
  });
  const info = await transporter.sendMail(mailOptions);
  console.log('Payment failed email sent to:', to, info.response);
}

async function sendOtpEmail(email, otp) {
  const otpBox = `<div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f4f6f9;color:${brandColor};padding:16px;text-align:center;border-radius:8px;margin:8px 0 16px;">${esc(otp)}</div>`;
  const mailOptions = buildMail({
    to: email,
    subject: 'ProBooks Accounting — Email Verification Code',
    heading: 'Your verification code',
    intro: 'Use the code below to verify your email address.',
    bodyHtml: otpBox,
    bodyText: `Your verification code is: ${otp}`,
    footerNote: 'This code expires in 10 minutes. Do not share it with anyone. If you did not request this, please ignore this email.',
  });
  const info = await transporter.sendMail(mailOptions);
  console.log('OTP email sent:', info.response);
}

module.exports = {
  createAndEmail,
  sendStatementByEmail,
  sendDonorStatementBuffer,
  createAndEmailDBBackup,
  emailMemberForUpdate,
  sendTransactionsEmail,
  sendNewUserAddedEmail,
  sendDonationReceivedEmail,
  sendTotalsExportEmail,
  sendTransactionsPDFBuffer,
  sendDonationsPDFBuffer,
  sendOtpEmail,
  sendInviteEmail,
  sendPaymentFailedEmail,
};
