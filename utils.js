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

function inferLevel(message) {
    const m = (message || '').toLowerCase();
    if (m.includes('error') || m.includes('failed') || m.includes('exception') || m.includes('crash')) return 'error';
    if (m.includes('warning') || m.includes('warn') || m.includes('invalid') || m.includes('duplicate') || m.includes('skipped') || m.includes('expired')) return 'warning';
    return 'info';
}

function log(update, charityId) {
    // Extract the username from messages formatted as "Name: message"
    const colonIdx = update ? update.indexOf(': ') : -1;
    const userName = colonIdx > 0 ? update.slice(0, colonIdx) : os.hostname();
    const level = inferLevel(update);
    // charityId is optional — logs without a tenant context (e.g. startup errors) are allowed
    const sql = charityId
      ? 'INSERT INTO console_logs (timestamp, "user", log_message, level, charity_id) VALUES (NOW(), $1, $2, $3, $4)'
      : 'INSERT INTO console_logs (timestamp, "user", log_message, level) VALUES (NOW(), $1, $2, $3)';
    const params = charityId ? [userName, update, level, charityId] : [userName, update, level];
    pool.query(sql, params).catch(err => console.error(err.message));
}

// Intercept console.error and console.warn so Node-level errors also appear in the logs
const _origError = console.error.bind(console);
const _origWarn  = console.warn.bind(console);
console.error = function (...args) {
    _origError(...args);
    const msg = args.map(a => (a instanceof Error ? a.stack : String(a))).join(' ');
    log('System: ' + msg);
};
console.warn = function (...args) {
    _origWarn(...args);
    const msg = args.map(a => String(a)).join(' ');
    log('System: ' + msg);
};

async function readCSVAndProcess(csvFilePath, req, res) {
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

    // Parse the CSV into memory first
    const results = await new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => {
                data.Date = convertDateFormat(data.Date);
                rows.push(data);
            })
            .on('end', () => resolve(rows))
            .on('error', reject);
    });

    fs.unlinkSync(csvFilePath);

    let inserted = 0;
    let skipped  = 0;

    for (const row of results) {
        const description = row.Description?.toLowerCase() || "";
        let inferredType = null;

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

        // Normalise amounts so '178.6' and '178.60' are treated as equal
        const normAmount = v => {
            if (!v) return null;
            const n = parseFloat(v);
            return isNaN(n) ? v : n.toFixed(2);
        };

        const paidIn  = normAmount(row['Paid In']);
        const paidOut = normAmount(row['Paid Out']);

        try {
            const result = await pool.query(`
                INSERT INTO transactions (
                    date, transaction_type, type, description, paid_out, paid_in, balance, notes, charity_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (date, description, COALESCE(paid_in, ''), COALESCE(paid_out, ''), charity_id) DO NOTHING
            `, [
                row.Date,
                row.Type,
                inferredType,
                row.Description,
                paidOut,
                paidIn,
                row.Balance || null,
                null,
                req.charityId,
            ]);

            if (result.rowCount > 0) {
                inserted++;
                log("Row inserted: " + row.Description, req.charityId);
            } else {
                skipped++;
                log("Duplicate skipped: " + row.Description, req.charityId);
            }
        } catch (err) {
            log("Error inserting row: " + row.Description + " — " + err.message, req.charityId);
        }
    }

    if (skipped > 0) {
        req.flash('warning', `Import complete: ${inserted} transaction(s) added, ${skipped} duplicate(s) skipped.`);
    } else {
        req.flash('success', `Import complete: ${inserted} transaction(s) added.`);
    }
    return res.redirect('/admin');
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

