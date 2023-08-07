const { log } = require('console');
const fs = require('fs');
const nodemailer = require('nodemailer');

const emailConfig = {
  host: 'smtp.zoho.eu',
  port: '465',
  secure: true,
  auth: {
    user: 'mailer@probooksaccounting.co.uk',
    pass: 'ZAmBWUPFDEwz',
  },
};

const receiver = 'info@nlcsunderland.uk';

async function createAndEmail(fileType, subject, message) {
  const fileName = `${fileType}.csv`;
  const backupFilename = `${fileType}_backup.csv`;

  fs.copyFileSync(fileName, backupFilename);

  const transporter = nodemailer.createTransport(emailConfig);

  const mailOptions = {
    from: emailConfig.auth.user,
    to: receiver,
    subject: subject,
    text: `Find attached the ${message}.`,
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

  fs.unlinkSync(backupFilename);
  fs.unlinkSync(fileName);
}

async function sendStatementByEmail(pdfPath) {
  const transporter = nodemailer.createTransport(emailConfig);

  const mailOptions = {
    from: emailConfig.auth.user,
    to: receiver,
    subject: 'Statement of Donations',
    text: 'Find attached the statement of donations.',
    attachments: [
      {
        filename: pdfPath,
        path: `./${pdfPath}`,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log("Statement sent: " + pdfPath + info.response);
    fs.unlinkSync(pdfPath);
  } catch (error) {
    log("'Error sending email: " + error)
  }
}

async function createAndEmailDBBackup() {
  const dbFilename = 'db.sqlite';

  const backupFilename = 'db_backup.sqlite';
  fs.copyFileSync(dbFilename, backupFilename);

  const transporter = nodemailer.createTransport(emailConfig);
  const mailOptions = {
    from: emailConfig.auth.user,
    to: receiver,
    subject: 'ProBooks Accounting - Database Backup',
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

module.exports = {
  createAndEmail,
  sendStatementByEmail,
  createAndEmailDBBackup,
};
