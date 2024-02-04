const e = require('connect-flash');
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
const emailFooter = "\n\n\n\nThank you for using our services!\nProBooks Accounting\n\nIf you have any doubts using our services, please reply to this email\n\n\n\n Probooks Accounting © - Alpha Media Productions Ltd."

async function createAndEmail(fileType, subject, message) {
  const fileName = `${fileType}.csv`;
  const backupFilename = `${fileType}_backup.csv`;

  fs.copyFileSync(fileName, backupFilename);

  const transporter = nodemailer.createTransport(emailConfig);

  const mailOptions = {
    from: emailConfig.auth.user,
    to: receiver,
    subject: subject,
    text: `Find attached the ${message}.` + emailFooter,
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
    text: 'Find attached the statement of donations.' + emailFooter,
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
    to: 'mailer@probooksaccounting.co.uk',
    subject: 'ProBooks Accounting - Database Backup',
    text: 'Find attached the database backup.' + emailFooter,
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
}

async function emailMemberForUpdate (row) {
  const transporter = nodemailer.createTransport(emailConfig);
  
  link = "https://probooksaccounting.co.uk/edit-member/"+row.id;
  const mailOptions = {
    from: emailConfig.auth.user,
    to: row.email,
    subject: 'ProBooks Accounting - Update Member Details',
    text: 'Dear ' + row.first_name + ' ' + row.surname + ',\n\nPlease click on the link below to check your details stored by NewLife Church Sunderland, and update any details that are not correct.\n ' + link + emailFooter,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }

}

module.exports = {
  createAndEmail,
  sendStatementByEmail,
  createAndEmailDBBackup,
  emailMemberForUpdate
};
