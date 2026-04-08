const e = require('connect-flash');
const { log } = require('console');
const fs = require('fs');
const nodemailer = require('nodemailer');

const emailConfig = {
  host: "smtp.zoho.eu",
  port: 465,            // use number, not string
  secure: true,         // Zoho requires SSL on port 465
  auth: {
    user: "mailer@probooksaccounting.co.uk",
    pass: "ZAmBWUPFDEwz",
  },
  pool: true,           // keep a connection pool
  rateLimit: true,      // enable built-in rate limiting
  maxConnections: 1,    // only 1 active SMTP connection at a time
  maxMessages: 5,       // max 5 messages per connection
};

const sender = '"ProBooks Accounting" <mailer@probooksaccounting.co.uk>'
const receiver = 'albinm65@gmail.com';
const emailFooter = "\n\n\n\nThank you for using our services!\n\nIf you have any doubts using our services, please reply to this email\n\n\n\n Probooks Accounting © - Alpha Media Productions Ltd."

// Single shared transporter — pool:true only benefits if the same instance is reused
const transporter = nodemailer.createTransport(emailConfig);

async function createAndEmail(fileType, subject, message) {
  const fileName = `${fileType}.csv`;
  const backupFilename = `${fileType}_backup.csv`;

  fs.copyFileSync(fileName, backupFilename);

  const mailOptions = {
    from: sender,
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
    console.error('Error sending email: ', error);
  }

  fs.unlinkSync(backupFilename);
  fs.unlinkSync(fileName);
}

async function sendStatementByEmail(pdfPath) {
  const mailOptions = {
    from: sender,
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

async function sendTransactionsEmail(pdfPath, receiverEmail) {
  const mailOptions = {
    from: sender,
    to: receiverEmail,
    subject: 'Statement of Transactions',
    text: 'As requested, please find attached the statement of transactions.' + emailFooter,
    attachments: [
      {
        filename: pdfPath,
        path: `./${pdfPath}`,
      },
    ],
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    log("Transactions email sent: " + pdfPath + info.response);
    fs.unlinkSync(pdfPath);
  } catch (error) {
    log("'Error sending email: " + error)
  }
}

async function createAndEmailDBBackup() {
  const dbFilename = 'db.sqlite';

  const backupFilename = 'db_backup.sqlite';
  fs.copyFileSync(dbFilename, backupFilename);

  const mailOptions = {
    from: sender,
    to: 'albinm65@gmail.com',
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
  link = "https://probooksaccounting.co.uk/edit-member/"+row.id;
  const mailOptions = {
    from: sender,
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

async function sendUpdateSuggestionEmail(suggestion, user) {
  const mailOptions = {
    from: sender,
    to: "albinm65@gmail.com",
    subject: 'Update Suggestion from User',
    text: user + ' Has suggested this update to the software: ' + suggestion + ". Please respond!" + emailFooter,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    log("Update suggestion email sent by: " + user + ' ' + info.response);
  } catch (error) {
    log("'Error sending email: " + error)
  }
}

async function sendNewUserAddedEmail(user) {
  const mailOptions = {
    from: sender,
    to: "albinm65@gmail.com",
    subject: 'New User Added',
    text: user + ' Has been added. ' + emailFooter,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    log("New user email sent:" + ' ' + info.response);
  } catch (error) {
    log("'Error sending email: " + error)
  }
}

async function sendDonationReceivedEmail(member, donation) {
  const mailOptions = {
    from: sender,
    to: member.email,
    subject: 'Your Donation to NewLife Church Sunderland',
    text: 'Dear ' + member.first_name + ' ' + member.surname + ',\n\nYour donation to NewLife Church Sunderland has been acknowledged by the treasurer. Here are the details: \n\nDonation Amount: £' + donation.amount + '\nFund: ' + donation.fund + '\nDated: ' + donation.date + '\n\nLet each man give according as he has determined in his heart, not grudgingly or under compulsion, for God loves a cheerful giver. - 2 Corinthians 9:7' + emailFooter,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    log("New donation email sent to: " + member.email + ' ' + info.response);
  } catch (error) {
    log("'Error sending email: " + error)
  }
}

async function sendTotalsExportEmail(to, csvBuffer, pdfBuffer, csvFilename, pdfFilename) {
  const mailOptions = {
    from: sender,
    to,
    subject: 'ProBooks Accounting - Totals Export',
    text: 'Please find attached the totals export as both a CSV and PDF file.' + emailFooter,
    attachments: [
      { filename: csvFilename, content: csvBuffer, contentType: 'text/csv' },
      { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  };
  const info = await transporter.sendMail(mailOptions);
  console.log('Totals export email sent:', info.response);
}

async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from: sender,
    to: email,
    subject: 'ProBooks Accounting — Email Verification Code',
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you did not request this, please ignore this email.${emailFooter}`,
  };
  const info = await transporter.sendMail(mailOptions);
  console.log('OTP email sent:', info.response);
}

module.exports = {
  createAndEmail,
  sendStatementByEmail,
  createAndEmailDBBackup,
  emailMemberForUpdate,
  sendTransactionsEmail,
  sendUpdateSuggestionEmail,
  sendNewUserAddedEmail,
  sendDonationReceivedEmail,
  sendTotalsExportEmail,
  sendOtpEmail,
};
