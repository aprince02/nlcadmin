const { log } = require('console');
const fs = require('fs');
const nodemailer = require('nodemailer');

async function createAndEmailDBBackup(email, password) {
  const dbFilename = 'db.sqlite';

  const backupFilename = 'db_backup.sqlite';
  fs.copyFileSync(dbFilename, backupFilename);

  // Email configuration
  const senderEmail = email;
  const receiverEmail = email;

  const transporter = nodemailer.createTransport({
    service: 'gmail', // Change this for other email providers
    auth: {
      user: senderEmail,
      pass: password,
    },
  });

  const mailOptions = {
    from: senderEmail,
    to: receiverEmail,
    subject: 'Database Backup',
    text: 'Find attached the database backup.',
    attachments: [
      {
        filename: backupFilename,
        path: backupFilename,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }

  // Delete the backup file after sending the email
  fs.unlinkSync(backupFilename);
}

async function sendStatementByEmail(email, password, pdfPath) {
  const senderEmail = email;
  const receiverEmail = email;

  const transporter = nodemailer.createTransport({
    service: 'gmail', // Change this for other email providers
    auth: {
      user: senderEmail,
      pass: password,
    },
  });

  const mailOptions = {
    from: senderEmail,
    to: receiverEmail,
    subject: 'Statement of Donations',
    text: 'Find attached the statement of donations.',
    attachments: [
      {
        filename: pdfPath,
        path: pdfPath,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log("Statement sent: " + pdfPath + info.response);
  } catch (error) {
    log("'Error sending email: " + error)
    console.error('Error sending email:', error);
  }
}

module.exports = { createAndEmailDBBackup, sendStatementByEmail };