const os = require('os');
const pool = require("./database.js")
const csv = require('csv-parser');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const {createAndEmail} = require('./emailer');

// returns todays date in correct format
function formatted_date() {
    var date_today = new Date();
    var dd = date_today.getDate();
    var mm = date_today.getMonth()+1;
    var yyyy = date_today.getFullYear();
    if(dd<10) {
        dd='0'+dd;
    } 
    if(mm<10) {
        mm='0'+mm;
    }
    var today = yyyy+'-'+mm+'-'+dd;
    return today;
}

function log(update, charityId) {
    const computerName = os.hostname();
    // charityId is optional — logs without a tenant context (e.g. startup errors) are allowed
    const sql = charityId
      ? 'INSERT INTO console_logs (timestamp, "user", log_message, charity_id) VALUES (NOW(), $1, $2, $3)'
      : 'INSERT INTO console_logs (timestamp, "user", log_message) VALUES (NOW(), $1, $2)';
    const params = charityId ? [computerName, update, charityId] : [computerName, update];
    pool.query(sql, params).catch(err => console.error(err.message));
}

function readCSVAndProcess(csvFilePath, req, res, next) {
    if (!csvFilePath.toLowerCase().endsWith('.csv')) {
        log("File is not a CSV. Process aborted.");
        req.flash('error', 'File is not a CSV');
        fs.unlinkSync(csvFilePath);
        return res.redirect('/admin');
    }

    if (!fs.existsSync(csvFilePath)) {
        log("CSV file not found. Process aborted.");
        req.flash('error', 'CSV file not found');
        return res.redirect('/admin');
    }
    const results = [];
    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
            data.Date = convertDateFormat(data.Date);
            results.push(data);
        })
        .on('end', () => {
    results.forEach(row => {
        // Default to null
        let inferredType = null;

        // Normalize description for case-insensitive matching
        const description = row.Description?.toLowerCase() || "";

        if (description.includes("offering")) {
            inferredType = "Offering";
        } else if (description.includes("zoom")) {
            inferredType = "Audio/Visual/Licenses";
        } else if (description.includes("food")) {
            inferredType = "Food";
        } else if (description.includes("hmrc charities")) {
            inferredType = "Gift Aid Claim";
        } else if (description.includes("snacks")) {
            inferredType = "Food";
        } else if (description.includes("total charges")) {
            inferredType = "Bank Charges";
        }

        const sql = `
            INSERT INTO transactions (
                date, transaction_type, type, description, paid_out, paid_in, balance, notes, charity_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        const params = [
            row.Date,
            row.Type,
            inferredType,
            row.Description,
            row['Paid Out'],
            row['Paid In'],
            row.Balance,
            null,
            req.charityId
        ];

        pool.query(sql, params)
            .then(() => log("Row inserted successfully: " + row.Description, req.charityId))
            .catch(err => log("Error inserting row into the database: " + row.Description + " " + err.message, req.charityId));
    });

    fs.unlinkSync(csvFilePath);
});
}

  function convertDateFormat(dateString) {
    const months = {
      "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
      "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
    };
  
    const dateParts = dateString.split(' ');
    const day = dateParts[0];
    const month = months[dateParts[1]];
    const year = dateParts[2];
    return `${year}-${month}-${day}`;
  }

  function requireLogin(req, res, next) {
    if (req.session && req.session.email) {
        next();
    } else {
        res.redirect('/login');
    }}

/**
 * Reads charityId from the session and attaches it to req.charityId.
 * Must be used after requireLogin on all routes that access tenant data.
 * Never trusts charity_id from the request body/query — always from session.
 */
function injectCharityId(req, res, next) {
  const charityId = req.session.charityId;
  if (!charityId) {
    req.flash('error', 'Session error. Please log in again.');
    return res.redirect('/login');
  }
  req.charityId = charityId;
  next();
}

function checkUserRole(req, res, next) {
    if (req.session.role === 'admin') {
        next();
    } else if (req.session.role === 'super admin') {
      next();
    } else {
        req.flash('error', 'Only Admins are allowed to use this functionality.');
        res.redirect('/claimants/:page');
    }};

function checkSuperAdmin(req, res, next) {
  if (req.session.role === 'super admin') {
      next();
  } else {
      req.flash('error', 'Only Super Admins are allowed to use this functionality.');
      res.redirect('/admin');
  }};

function checkAdmin(req, res, next) {
  if (req.session.role === 'admin' || req.session.role === 'super admin') {
      next();
  } else {
      req.flash('error', 'Only Admins are allowed to use this functionality.');
      res.redirect('/admin');
  }};

  function checkApprovedUser(req, res, next) {
    if (req.session.approval === 'approved') {
        next();
    } else {
        req.flash('error', 'Only approved users are allowed to access the software.');
        res.redirect('/login');
    }};


async function exportDonationsCsv(req, res) {
    const tableName = 'donations';
    db.all(`SELECT * FROM ${tableName}`, function(err, rows) {
      if (err) {
        req.flash('error', 'Error retrieving data to export donations.');
        log('Error retrieving data to export donations.')
      }
      
      const csvWrite = csvWriter({
        path: 'donations.csv',
        header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
      });
      
      csvWrite.writeRecords(rows)
        .then(() => {
          res.download('donations.csv');
          req.flash('success', 'Donations successfully exported.');
          log('Donations successfully exported')
        })
        .catch(() => {
          req.flash('error', 'Error generating CSV file for donations.');
          log('Error generating CSV file for donations.')
        });
    });
    try {
      await createAndEmail('donations', 'ProBooks Accounting - Donations Export CSV File', 'donations export csv file');
      log('Donations sent via email!');
    } catch (error) {
      log("Error sending donations email")
    }
}

module.exports = {
    formatted_date,
    log,
    readCSVAndProcess,
    convertDateFormat,
    requireLogin,
    injectCharityId,
    checkUserRole,
    exportDonationsCsv,
    checkSuperAdmin,
    checkAdmin,
    checkApprovedUser
}

