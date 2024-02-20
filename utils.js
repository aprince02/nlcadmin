const os = require('os');
var db = require("./database.js")
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

function log(update) {
    const sql = "INSERT INTO console_logs (timestamp, user, log_message) VALUES (datetime('now'), ?, ?)";
    const computerName = os.hostname();
    const data = [computerName, update];
  
    db.run(sql, data, err => {
      if (err) {
        console.error(err.message);
        return;
      }
    });
  }

// Function to read the CSV file and process its contents
function readCSVAndProcess(csvFilePath, req, res, next) {
  
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
          const sql = "INSERT INTO transactions (date, transaction_type, type, description, paid_out, paid_in, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
          const params = [row.Date, row.Type, null, row.Description, row['Paid Out'], row['Paid In'], row.Balance, null];
  
          db.run(sql, params, (err) => {
            if (err) {
              log("Error inserting row into the database: " + err.message);
            } else {
              log("Row inserted successfully: " + row);
            }
          });
        });
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

function checkUserRole(req, res, next) {
    if (req.session.role === 'admin') {
        next();
    } else if (req.session.role === 'super admin') {
      next();
    } else {
        req.flash('error', 'Only Admins are allowed to use this functionality.');
        res.redirect('/claimants');
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
    checkUserRole,
    exportDonationsCsv
}

