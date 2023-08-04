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

async function createAndEmailTransactions(email, password) {
  const fileName = 'transactions.csv';

  const backupFilename = 'transactions_backup.csv';
  fs.copyFileSync(fileName, backupFilename);

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
    subject: 'Transactions CSV File',
    text: 'Find attached the transactions CSV file.',
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

async function createAndEmailDonations(email, password) {
  const fileName = 'donations.csv';

  const backupFilename = 'donations_backup.csv';
  fs.copyFileSync(fileName, backupFilename);

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
    subject: 'Donations CSV File',
    text: 'Find attached the donations CSV file.',
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

async function createAndEmailGiftAid(email, password) {
  const fileName = 'giftaid_claim.csv';

  const backupFilename = 'giftaid_claim_backup.csv';
  fs.copyFileSync(fileName, backupFilename);

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
    subject: 'Gift Aid Claim CSV File',
    text: 'Find attached the gift aid claim CSV file.',
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

async function createAndEmailTotals(email, password) {
  const fileName = 'total_paid_in_out.csv';

  const backupFilename = 'total_paid_in_out_backup.csv';
  fs.copyFileSync(fileName, backupFilename);

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
    subject: 'Totals CSV File',
    text: 'Find attached the totals CSV file.',
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
  }
}

module.exports = { createAndEmailDBBackup, sendStatementByEmail, createAndEmailTransactions, createAndEmailDonations, createAndEmailGiftAid, createAndEmailTotals };