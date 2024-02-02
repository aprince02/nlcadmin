var express = require("express")
const fs = require('fs');
var app = express()
var db = require("./database.js")
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const csvWriter = require('csv-writer').createObjectCsvWriter;
const { generatePDF } = require('./pdf-generator');
const { exec } = require('child_process');
const path = require('path');
const multer = require('multer');
const schedule = require('node-schedule');
const {
  requireLogin,
  checkUserRole,
  readCSVAndProcess,
  log,
  exportDonationsCsv
} = require('./utils');
const { sendStatementByEmail, createAndEmail, createAndEmailDBBackup, emailMemberForUpdate } = require('./emailer');
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.use(function(req, res, next){
    res.locals.message = req.flash();
    next();

});
// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });
app.listen(8000, () => {
  console.log("Server running on port: %PORT%".replace("%PORT%",8000))
});

  app.get("/admin", (req, res) =>  {
    const loggedInName = req.session.name;
    res.render("admin", {loggedInName: loggedInName});
  });

// GET /claimants
app.get("/claimants", requireLogin, (req, res) => {
    const sql = "SELECT * FROM members ORDER BY first_name ASC"
    const loggedInName = req.session.name;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("claimants", {model: rows, loggedInName: loggedInName});
        }});
    });

// GET /yearly-transactions
app.get("/yearly-transactions", requireLogin, (req, res) => {
    const sql = "SELECT * FROM transactions ORDER BY date DESC"
    const loggedInName = req.session.name;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("yearly-transactions", {row: rows, loggedInName: loggedInName});
        }});
    });

// GET /edit/id
app.get("/edit/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const claimant_sql = "SELECT * FROM members WHERE id = ?";
    db.get(claimant_sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("edit", { member: row, loggedInName: loggedInName });
        }});
    });

// POST /edit/id
app.post("/edit/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id];
    const sql = "UPDATE members SET first_name = ?, surname = ?, banking_name = ?, date_of_birth = ?, sex = ?, email = ?, phone_number = ?, address_line_1 = ?, address_line_2 = ?, city = ?, postcode = ?, baptised = ?, baptised_date = ?, holy_spirit = ?, native_church = ?, children_details = ?, emergency_contact_1 = ?, emergency_contact_1_name = ?, emergency_contact_2 = ?, emergency_contact_2_name = ?, occupation_studies = ?, title = ?, house_number = ?, spouse_name = ?  WHERE (id = ?)";
    db.run(sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Member details updated successfully.');
            log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name)
            res.redirect("/claimants");
        }});
    });

// GET /create
app.get("/create", requireLogin, (req, res) => {
    const loggedInName = req.session.name;
    res.render("create", { member: {}, bank_account: {} , loggedInName: loggedInName });
  });

// POST /create
app.post("/create", requireLogin, (req, res) => {
    const claimant_sql = "INSERT INTO members (first_name, surname, spouse_name, banking_name, sex, email, phone_number, address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name, emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const claimant = [req.body.first_name, req.body.surname, req.body.spouse_name, req.body.banking_name, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.date_of_birth, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number,];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'New member added successfully.');
            log("Added new member with first name: " + req.body.first_name + "and last name: " + req.body.surname)
            res.redirect("/claimants");
        }}); 
    });

// GET /delete/id
app.get("/delete/:id", requireLogin, checkUserRole, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const sql = "SELECT * FROM members WHERE id = ?";
    db.get(sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("delete", { member: row, loggedInName: loggedInName });
        }});
    });

// POST /delete/id
app.post("/delete/:id", requireLogin, checkUserRole, (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM members WHERE id = ?";
    db.run(sql, id, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Member deleted successfully.');
            log("Deleted member with id: " + id)
            res.redirect("/claimants");
        }});
    });

// GET /all-donations
app.get("/all-donations", requireLogin, (req, res) => {
    const loggedInName = req.session.name;
    const donations_sql = "SELECT * FROM donations ORDER BY date DESC";
    db.all(donations_sql, [], (err, row) => {
        if (err) {
          return console.error(err.message);
        } else {
            res.render("all-donations", {model: row, loggedInName: loggedInName });
        }});
    });

// GET /add-payment/id
app.get("/select-giver", requireLogin, (req, res) => {
    const sql = "SELECT * FROM members ORDER BY first_name ASC"
    const loggedInName = req.session.name;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("select-giver", {row: rows, loggedInName: loggedInName});
        }});
    });

// GET /add-donation/id
app.get("/add-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM members WHERE id = ?"
    const donationDate = req.session.date;
    const donationDescription = req.session.description;
    const donationAmount = req.session.incoming;
    const loggedInName = req.session.name;
    db.get(sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("add-donation", { row: row, loggedInName: loggedInName, donationDate: donationDate, donationAmount: donationAmount, donationDescription: donationDescription});
        }});
    });

// GET /edit-donation/id
app.get("/edit-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM donations WHERE id = ?"
    const loggedInName = req.session.name;
    db.get(sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("edit-donation", { row: row, loggedInName: loggedInName});
        }});
    });

// POST /edit-donation
app.post("/edit-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const date = req.body.date;
    const notes = req.body.notes;
    const fund = req.body.fund;
    const amount = req.body.amount;
    const method = req.body.method;
    const claimant_sql = "UPDATE donations SET date = ?, notes = ?, fund = ?, amount = ?, method = ? WHERE (id = ?)";
    const claimant = [date, notes, fund, amount, method, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            req.flash('error', 'Error editing donation, please try again!')
            console.log(err.message);
        } else {
          req.flash('success', 'Donation edited successfully!')
            log("Edited donation with id: " + id)
            res.redirect("/all-donations");
        }}); 
    });

// POST /add-payment/id
app.post("/add-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const payment_sql = "INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes) VALUES (?,?,?,?,?,?,?,?,?)";
    const status = "Unclaimed";
    const bank = "Bank"
    const payment = [id, req.body.first_name, req.body.surname, req.body.amount, req.body.date, req.body.fund, bank, status, req.body.notes];
    
    db.run(payment_sql, payment, err => {
        if (err) {
          req.flash('error', 'Error adding donation, please try again!');
            log(err.message);
            console.error(err.message);
            return res.redirect("/select-giver"); 
        } else {
            req.flash('success', 'Donation added successfully.');
            log("Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname)
            return res.redirect("/select-giver"); 
        }});
    });

// GET /payments/id
app.get("/donations/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const sql = "SELECT * FROM donations WHERE member_id = ? ORDER by date DESC";
    db.all(sql, id, (err, rows) => {
        if (err) {
          return console.error(err.message);
        }else if (!rows || rows.length === 0) {
            res.redirect("/no-donations/" + encodeURI(id));

        } else {
            const firstName = rows[0].first_name || "";
            const surname = rows[0].surname || "";
            let totalAmount = 0;
            rows.forEach((row) => {
                totalAmount += row.amount;
            });

            res.render("donations", {model: rows, id: id, loggedInName: loggedInName, firstName: firstName, surname: surname, totalAmount: totalAmount});
        }
    });
    });

// GET /payments/id
app.get("/no-donations/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    res.render("no-donations", { id: id, loggedInName: loggedInName });

    });


// GET /register
app.get("/register", (req, res) =>  {
    res.render("register");
});

// POST /register
app.post("/register", (req, res) => {
    const user_sql = "INSERT INTO user (name, email, password, role) VALUES (?, ?, ?, ?)";
    var password = req.body.password;
    bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {
            const role = "user";
            const user = [req.body.username, req.body.email, hash, role];
            
            db.run(user_sql, user, err => {
                if (err) {
                    req.flash('error', 'Error registering new account, try again.');
                    return res.redirect("/register")
                } else {
                    req.flash('success', 'New account created successfully.');
                    return res.redirect("/login");
                }});
        });
    });
});

// POST /save-transactions
app.post("/save-transaction/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const type = req.body.type;
    const description = req.body.description;
    req.session.date = req.body.date;
    req.session.description = req.body.description;
    req.session.incoming = req.body.paid_in;
    req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
        }
      });

    const claimant_sql = "UPDATE transactions SET type = ?, description = ? WHERE (id = ?)";
    const claimant = [type, description, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            req.flash('error', 'Error saving transaction, please try again!');
            log(err.message);
            console.log(err.message);
            return res.redirect("/yearly-transactions");
        } else {
            req.flash('success', 'Transaction type saved successfully.');
            log("Transaction with id: " + id + " saved with type:" + type)
        }}); 
    });

// GET /login
app.get("/login", (req, res) =>  {
    res.render("login");
});

// POST /login
app.post("/login", (req, res) =>  {
    const email = req.body.email;
    const password = req.body.password;
    db.get('SELECT * FROM user WHERE email = ?', [email], (err, row) => {
    if (err) {
        throw err;
    }else if (!row) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/login');
    }

    bcrypt.compare(password, row.password, function(err, result){
        if (err){
            console.log(err.message);
        } else if (result === true) {
            req.session.email = email;
            req.session.name = row.name;
            req.session.role = row.role;
            db.get("SELECT * FROM last_update ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) {
                    throw err;
                }else {
                    log("User " + req.session.name + " logged in");
                }
            });

            res.redirect('claimants');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }});     
    });
});

app.get('/export-transactions', checkUserRole, async function(req, res) {
  const tableName = 'transactions';
  
  db.all(`SELECT * FROM ${tableName}`, function(err, rows) {
    if (err) {
      req.flash('error', 'Error retrieving data to export transactions.');
      log('Error retrieving data for transactions.')
    }
    
    const csvWrite = csvWriter({
      path: 'transactions.csv',
      header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
    });
    
    csvWrite.writeRecords(rows)
      .then(() => {
        res.download('transactions.csv');
      })
      .catch(() => {
        log('Error generating CSV file for transactions.')
        req.flash('error', 'Error generating CSV file for transactions.');
      });
  });
  try {
    await createAndEmail('transactions', 'ProBooks Accounting - Transactions Export CSV', 'transactions export csv file');
    log('Transactions sent via email!');
  } catch (error) {
    log("Error sending transactions email")
  }
});

app.get('/export-donations', checkUserRole, async function(req, res) {
    try {
      await exportDonationsCsv(req, res);
      req.flash('success', 'Donations export sent via email successfully.');
      log('Donations sent via email!');
    } catch (error) {
      req.flash('error', 'Unable to send donations export via email.');
      log("Error sending donations email")
    }
  });

  app.get('/db-backup', async (req, res) => {
    try {
      await createAndEmailDBBackup();
      log('Database backup sent via email!');
      req.flash('success', 'Database backup sent via email successfully.');
      return res.redirect('/admin')
    } catch (error) {
       log("Error sending database backup" + error.message)
      req.flash('error', 'Error sending database backup.');
      return res.redirect('/admin');
    }
  });

const scheduledTime = '59 23 * * 0'; // '59 23 * * 0' represents every Sunday at 23:59
schedule.scheduleJob(scheduledTime, async () => {
  try {
    await createAndEmailDBBackup();
    log('Database backup sent via email!');
  } catch (error) {
    log("Error sending database backup: " + error.message);
  }
});

  app.get("/export-totals", checkUserRole, async function(req, res) {

    const sql = "SELECT * FROM transactions WHERE date >= '2022-01-01'  ORDER BY type";
  
  db.all(sql, function(err, rows) {
    if (err) {
      req.flash('error', 'Error retrieving data for donations.');
      return res.redirect('/admin');
    }

    // Calculate the total "Paid In" for each type of transaction
    const types = [
        'Tithe', 'Offering', 'Church Building', 'Vehicle', 'Building Rent',
        'Ladies Fund', 'Sunday School Offering', 'Guest Pastor', 'Support & Charity',
        'Audio/Visual/Licenses', 'Books & Stationary', 'Provisions', 'Gifts', 'Other Income',
        'Gift Aid Claim', 'VBS', 'Evangelism', 'AoG', 'Legal', 'Anniversary',
        'Membership Interest Free Loan', 'Other Donations', 'Live Music Event', 'Bank Charges'
      ];
  
      const totalPaidInByType = {};
    const totalPaidOutByType = {};

    types.forEach(type => {
      const typeTransactions = rows.filter(row => row.type === type);
      
      // Calculate total "Paid In" for the current type
      const totalPaidIn = typeTransactions.reduce((total, transaction) => {
        const paidIn = parseFloat(transaction.paid_in) || 0;
        if (!isNaN(paidIn)) {
          total += paidIn;
        }
        return total;
      }, 0);

      // Calculate total "Paid Out" for the current type
      const totalPaidOut = typeTransactions.reduce((total, transaction) => {
        const paidOut = parseFloat(transaction.paid_out) || 0;
        if (!isNaN(paidOut)) {
          total += paidOut;
        }
        return total;
      }, 0);

      totalPaidInByType[type] = parseFloat(totalPaidIn.toFixed(2));;
      totalPaidOutByType[type] = parseFloat(totalPaidOut.toFixed(2));
    });
    
    const csvFilePath = "total_paid_in_out.csv";
  const csvWriterOptions = {
    path: csvFilePath,
    header: [
      { id: "type", title: "Type" },
      { id: "paid_in", title: "Paid In" },
      { id: "paid_out", title: "Paid Out" }
    ]
  };

  const dataToWrite = types.map(type => ({
    type: type,
    paid_in: totalPaidInByType[type],
    paid_out: totalPaidOutByType[type]
  }));

  const writer = csvWriter(csvWriterOptions);
  writer.writeRecords(dataToWrite)
    .then(() => {
      console.log("CSV file has been written successfully.");
    })
    .catch(err => {
      req.flash('error', 'Error generating CSV file for totals.');
      console.error("Error writing CSV file:", err);
      return res.redirect('/admin');
    });
  });
  try {
    await createAndEmail('total_paid_in_out', 'ProBooks Accounting - Totals Export CSV File', 'totals export csv file');
    log('Totals sent via email!');
  } catch (error) {
    log("Error sending totals email")
  }
});


  app.get('/export-giftaid-claims', checkUserRole, async function(req, res) {
  
    db.all(`SELECT members.first_name, members.surname, donations.amount, donations.date, 
      members.title, members.house_number, members.postcode
      FROM donations 
      INNER JOIN members ON donations.member_id = members.id 
      WHERE donations.gift_aid_status = 'Unclaimed'`, function(err, rows) {
      if (err) {
        req.flash('error', 'Error generating CSV file for gift aid claim.');
        return res.redirect('/admin');
      }
  
      const csvWrite = csvWriter({
        path: 'giftaid_claim.csv',
        header: [
            { id: 'title', title: 'Title' },  
            { id: 'first_name', title: 'First Name' },
            { id: 'surname', title: 'Surname' },
            { id: 'house_number', title: 'House Number' },
            { id: 'postcode', title: 'Postcode' },
            { id: 'date', title: 'Date' },
            { id: 'amount', title: 'Amount' }
        ]
      });
  
      csvWrite.writeRecords(rows)
        .then(() => {
          res.download('giftaid_claim.csv');
        })
        .catch(() => {
          req.flash('error', 'Error generating CSV file for gift aid claim.');
        });
    });
    try {
      await createAndEmail('giftaid_claim', 'Gift Aid Claim Export', 'gift aid claim export csv file');
      log('Gift Aid Claim sent via email!');
      db.run(`UPDATE donations SET gift_aid_status = 'Claimed' WHERE gift_aid_status = 'Unclaimed'`, function(err) {
        if (err) {
          log("Error updating gift_aid_status:", err.message);
        } else {
          log("Gift aid status updated successfully.");
        }
      });
    } catch (error) {
      log("Error sending gift aid claim email")
    }
  });
  
// GET /logout
app.get('/logout', (req, res) => {
    const sql = "INSERT INTO last_update (timestamp, user) VALUES (datetime('now'), ?)";
    const loggedInName = req.session.name;
    const data = [loggedInName];
    db.run(sql, data, err => {
        if (err) {
            return console.error(err.message);
        } else {
          const scriptPath = path.join(__dirname, 'ProBooksAccountingPush.sh');

        log("User logged out")
      exec(`"${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error.message}`);
        } else {
          console.log(`Batch script output: ${stdout}`);
        }

        // After executing the batch script, destroy the session and redirect
        req.session.destroy();
        res.redirect('/');
      });
        }});
    
});

app.get("/generate-donor-pdf/:id", (req, res) => {
  const id = req.params.id;
  const donorSql = "SELECT * FROM members WHERE id = ?";

  db.all(donorSql, id, (err, donor) => {
    if (err) {
      console.log(err.message);
      req.flash('error', 'Error fetching Donor details.');
    } else {
      const titheSql =
        "SELECT * FROM donations WHERE member_id = ? AND date BETWEEN '2021-01-01' AND '2023-12-31' AND fund = 'Tithe' ORDER BY date ASC";
      const donationSql =
        "SELECT * FROM donations WHERE member_id = ? AND date BETWEEN '2021-01-01' AND '2023-12-31' AND fund != 'Tithe' ORDER BY date ASC";

      Promise.all([
        new Promise((resolve, reject) => {
          db.all(titheSql, id, (err, tithe) => {
            if (err) {
              reject(err.message);
            } else {
              resolve(tithe);
            }
          });
        }),
        new Promise((resolve, reject) => {
          db.all(donationSql, id, (err, donations) => {
            if (err) {
              reject(err.message);
            } else {
              resolve(donations);
            }
          });
        })
      ])
        .then(([tithe, donations]) => {
          const processPDFAndEmail = async () => {
            try {
              const pdfPath = await generatePDF(donor, tithe, donations);
              await sendStatementByEmail(pdfPath);
              log("Statement of donations sent for: " + donor);
            } catch (err) {
              log("Error generating or sending the statement of donations for donor: " + donor);
            }
          };

          // Call the async function within the .then() block
          processPDFAndEmail();
        })
        .catch((err) => {
          req.flash('error', 'Error fetching tithe and donation details for donor.');
          return res.redirect('/claimants');
        });
    }
  });
});

  
  app.get("/import-transactions", requireLogin, checkUserRole, (req, res) => {
    const loggedInName = req.session.name;
    res.render("import-transactions", {loggedInName: loggedInName });
  });

  app.post("/import-transactions", requireLogin, checkUserRole, upload.single('csvfile'), (req, res) => {
    if (!req.file) {
      req.flash('No file uploaded, try again!');
      return res.redirect('/admin');
    } else {
      readCSVAndProcess(req.file.path, req, res);
      req.flash('File uploaded and processed successfully');
      return res.redirect('/admin');
    }
  });

// GET /create
app.get("/membership", (req, res) => {
  res.render("membership", { member: {}, bank_account: {} });
});

// POST /create
app.post("/membership", (req, res) => {
  const claimant_sql = "INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name, emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  const claimant = [req.body.first_name, req.body.surname, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.date_of_birth, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number,];
  db.run(claimant_sql, claimant, err => {
      if (err) {
          console.log(err.message);
          log('Error submitting membership form. ' + err.message)
          req.flash('error', 'Error submitting membership form, please try again!');
          res.redirect("/membership");
      } else {
          req.flash('success', 'Membership Form completed successfully. Thank You!');
          log("Added new member with first name: " + req.body.first_name + "and last name: " + req.body.surname)
          res.redirect("/membership");
      }}); 
  });

  // GET /edit/id
app.get("/edit-member/:id", (req, res) => {
  const id = req.params.id;

  const claimant_sql = "SELECT * FROM members WHERE id = ?";
  db.get(claimant_sql, id, (err, row) => {
      if (err) {
          console.log(err.message);
      } else {
          res.render("edit-member", { member: row});
      }});
  });

// POST /edit/id
app.post("/edit-member/:id", (req, res) => {
  const id = req.params.id;
  const claimant = [req.body.first_name, req.body.surname, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id];
  const sql = "UPDATE members SET first_name = ?, surname = ?, date_of_birth = ?, sex = ?, email = ?, phone_number = ?, address_line_1 = ?, address_line_2 = ?, city = ?, postcode = ?, baptised = ?, baptised_date = ?, holy_spirit = ?, native_church = ?, children_details = ?, emergency_contact_1 = ?, emergency_contact_1_name = ?, emergency_contact_2 = ?, emergency_contact_2_name = ?, occupation_studies = ?, title = ?, house_number = ?, spouse_name = ?  WHERE (id = ?)";
  db.run(sql, claimant, err => {
      if (err) {
          console.log(err.message);
      } else {
          req.flash('success', 'Member details updated successfully.');
          log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name)
          res.redirect("/edit-member/" + id);
      }});
  });

  app.get("/send-update-request/:id", async (req, res) => {
    const id = req.params.id;

    const claimant_sql = "SELECT * FROM members WHERE id = ?";
    db.get(claimant_sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
          try {
            emailMemberForUpdate(row);
            log('Update details link sent via email!');
            req.flash('success', 'Email sent successfully.');
            res.redirect("/edit/" + id);
          } catch (error) {
            log("Error sending update email")
            req.flash('error', 'Error sending email to member, try again!.');
            res.redirect("/edit/" + id);
          }   
        }});
  })

// Default response for any other request
app.use(function(req, res){
    res.status(404);
    res.redirect('/claimants')
});