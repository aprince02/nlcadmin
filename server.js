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
const pdfGenerator = require('./pdf-generator');
const { exec } = require('child_process');
const path = require('path');
const multer = require('multer');
const schedule = require('node-schedule');
const { requireLogin, checkUserRole, readCSVAndProcess, exportDonationsCsv } = require('./utils');
const transactionTypes = require('./transactionTypes');
const dbHelper = require('./dbHelper')
const { sendStatementByEmail, createAndEmail, createAndEmailDBBackup, emailMemberForUpdate, sendTransactionsEmail } = require('./emailer');
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
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }});

const upload = multer({ storage: storage });
app.listen(8000, () => {
  console.log("Server running on port: %PORT%".replace("%PORT%",8000))
});

  app.get("/admin", requireLogin, (req, res) =>  {
    const loggedInName = req.session.name;
    res.render("admin", {loggedInName: loggedInName});
  });

app.get("/claimants", requireLogin, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const rows = await dbHelper.getAllMembers();
      res.render("claimants", {model: rows, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering claimants page:', error);
      return res.redirect("/")
    }});

app.get("/yearly-transactions/:year", requireLogin, (req, res) => {
  const year = req.params.year;
  const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC";
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const typesSql = "SELECT type FROM transaction_types";
  const loggedInName = req.session.name;
  db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) {
          console.log(err.message);
      } else {
        db.all(typesSql, (err, types) => {
          if (err) {
              console.error(err.message);
          } else {
              res.render("yearly-transactions", { row: rows, types: types, loggedInName: loggedInName });
          }});
      }});
});

app.get("/edit/:id", async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id);
      res.render("edit", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering edit member page:', error);
      return res.redirect("/claimants")
    }});

app.post("/edit/:id", (req, res) => {
    const id = req.params.id;
    const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id];
    const sql = "UPDATE members SET first_name = ?, surname = ?, banking_name = ?, date_of_birth = ?, sex = ?, email = ?, phone_number = ?, address_line_1 = ?, address_line_2 = ?, city = ?, postcode = ?, baptised = ?, baptised_date = ?, holy_spirit = ?, native_church = ?, children_details = ?, emergency_contact_1 = ?, emergency_contact_1_name = ?, emergency_contact_2 = ?, emergency_contact_2_name = ?, occupation_studies = ?, title = ?, house_number = ?, spouse_name = ?  WHERE (id = ?)";
    db.run(sql, claimant, err => {
        if (err) {
            console.error(err.message);
        } else {
            req.flash('success', 'Member details updated successfully.');
            console.log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name)
            res.redirect("/claimants");
        }});
    });

app.get("/create", requireLogin, (req, res) => {
    const loggedInName = req.session.name;
    res.render("create", { member: {}, bank_account: {} , loggedInName: loggedInName });
  });

app.post("/create", requireLogin, async (req, res) => {
  try {
    await dbHelper.addNewMember(req);
    req.flash('success', 'New member added successfully.');
    console.log("Added new member with first name: " + req.body.first_name + " and last name: " + req.body.surname)
    res.redirect("/claimants");
  } catch (error) {
    console.error('Error adding new member. ' + err.message)
    req.flash('error', 'Error adding new member, please try again!');
    res.redirect("/claimants");
  }});

app.get("/delete/:id", requireLogin, checkUserRole, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id);
      res.render("delete", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering delete member page:', error);
      return res.redirect("/claimants")
    }});

app.post("/delete/:id", requireLogin, checkUserRole, (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM members WHERE id = ?";
    db.run(sql, id, err => {
        if (err) {
            console.error(err.message);
        } else {
            req.flash('success', 'Member deleted successfully.');
            console.log("Deleted member with id: " + id)
            res.redirect("/claimants");
        }});
    });

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

app.get("/select-giver", requireLogin, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const rows = await dbHelper.getAllMembers();
    res.render("select-giver", {row: rows, loggedInName: loggedInName});
  } catch (error) {
    console.error('Error rendering select-giver page:', error);
    return res.redirect("/claimants")
  }});

app.get("/add-donation/:id", requireLogin, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const donationDate = req.session.date;
    const donationDescription = req.session.description;
    const donationAmount = req.session.incoming;
    const row = await dbHelper.getMemberWithId(id);
    const types = await dbHelper.getAllDonationTypes();
    res.render("add-donation", { row: row, loggedInName: loggedInName, donationDate: donationDate, donationAmount: donationAmount, donationDescription: donationDescription, types: types});
  } catch (error) {
    console.error('Error rendering delete member page:', error);
    return res.redirect("/claimants")
  }});

app.get("/edit-donation/:id", requireLogin, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const row = await dbHelper.getDonationWithId(id);
    const types = await dbHelper.getAllDonationTypes();
    res.render("edit-donation", { row: row, loggedInName: loggedInName,  types: types});
  } catch (error) {
    console.error('Error rendering edit donation page:', error);
    return res.redirect("/claimants")
  }});

app.post("/edit-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const claimant_sql = "UPDATE donations SET date = ?, notes = ?, fund = ?, amount = ?, method = ? WHERE (id = ?)";
    const claimant = [req.body.date, req.body.notes, req.body.fund, req.body.amount, req.body.method, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            req.flash('error', 'Error editing donation, please try again!')
            console.error(err.message);
        } else {
          req.flash('success', 'Donation edited successfully!')
            console.log("Edited donation with id: " + id)
            res.redirect("/all-donations");
        }}); 
    });

app.post("/add-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const payment_sql = "INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes) VALUES (?,?,?,?,?,?,?,?,?)";
    const status = "Unclaimed";
    const bank = "Bank"
    const payment = [id, req.body.first_name, req.body.surname, req.body.amount, req.body.date, req.body.fund, bank, status, req.body.notes];
    db.run(payment_sql, payment, err => {
        if (err) {
          req.flash('error', 'Error adding donation, please try again!');
            console.error(err.message);
            return res.redirect("/select-giver"); 
        } else {
            req.flash('success', 'Donation added successfully.');
            console.log("Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname)
            return res.redirect("/select-giver"); 
        }});
    });

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
        }});
    });

app.get("/no-donations/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    res.render("no-donations", { id: id, loggedInName: loggedInName });
    });

app.get("/register", (req, res) =>  {
    res.render("register");
});

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
        }});
    const claimant_sql = "UPDATE transactions SET type = ?, description = ? WHERE (id = ?)";
    const claimant = [type, description, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            req.flash('error', 'Error saving transaction, please try again!');
            console.error(err.message);
            return res.redirect("/yearly-transactions");
        } else {
            req.flash('success', 'Transaction type saved successfully.');
            console.log("Transaction with id: " + id + " saved with type:" + type)
        }}); 
    });

app.get("/login", (req, res) =>  {
    res.render("login");
});

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
            console.error(err.message);
        } else if (result === true) {
            req.session.email = email;
            req.session.name = row.name;
            req.session.role = row.role;
            db.get("SELECT * FROM last_update ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) {
                    throw err;
                }else {
                    console.log("User " + req.session.name + " logged in");
                }});
            res.redirect('claimants');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }});     
    });
});

app.get('/export-transactions', requireLogin, checkUserRole, async function(req, res) {
  db.all(`SELECT * FROM transactions`, function(err, rows) {
    if (err) {
      req.flash('error', 'Error retrieving data to export transactions.');
      console.error('Error retrieving data for transactions.' + err)
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
        console.error('Error generating CSV file for transactions.')
        req.flash('error', 'Error generating CSV file for transactions.');
      });
  });
  try {
    await createAndEmail('transactions', 'ProBooks Accounting - Transactions Export CSV', 'transactions export csv file');
    console.log('Transactions CSV sent via email!');
  } catch (error) {
    console.error("Error sending transactions email" + error)
  }});

app.get('/export-donations', requireLogin, checkUserRole, async function(req, res) {
    try {
      await exportDonationsCsv(req, res);
      req.flash('success', 'Donations export sent via email successfully.');
      console.log('Donations CSV sent via email!');
    } catch (error) {
      req.flash('error', 'Unable to send donations export via email.');
      console.error("Error sending donations email" + error)
    }});

  app.get('/db-backup', requireLogin, checkUserRole, async (req, res) => {
    try {
      await createAndEmailDBBackup();
      console.log('Database backup sent via email!');
      req.flash('success', 'Database backup sent via email successfully.');
      return res.redirect('/admin')
    } catch (error) {
       console.error("Error sending database backup" + error.message)
      req.flash('error', 'Error sending database backup.');
      return res.redirect('/admin');
    }});

const scheduledTime = '59 23 * * 0'; // '59 23 * * 0' represents every Sunday at 23:59
schedule.scheduleJob(scheduledTime, async () => {
  try {
    await createAndEmailDBBackup();
    console.log('Database backup sent via email!');
  } catch (error) {
    console.error("Error sending database backup: " + error.message);
  }});

app.get("/export-totals", requireLogin, checkUserRole, async function(req, res) {
    const sql = "SELECT * FROM transactions WHERE date >= '2022-01-01'  ORDER BY type";
    db.all(sql, async function(err, rows) {
        if (err) {
            req.flash('error', 'Error retrieving data for donations.');
            return res.redirect('/admin');
        }
        const totalPaidInByType = {};
        const totalPaidOutByType = {};
        try {
            const types = await transactionTypes.getAllTransactionTypes();
            types.forEach(type => {
                const typeTransactions = rows.filter(row => row.type === type);
                const totalPaidIn = typeTransactions.reduce((total, transaction) => {
                    const paidIn = parseFloat(transaction.paid_in) || 0;
                    if (!isNaN(paidIn)) {
                        total += paidIn;
                    }
                    return total;
                }, 0);
                const totalPaidOut = typeTransactions.reduce((total, transaction) => {
                    const paidOut = parseFloat(transaction.paid_out) || 0;
                    if (!isNaN(paidOut)) {
                        total += paidOut;
                    }
                    return total;
                }, 0);
                totalPaidInByType[type] = parseFloat(totalPaidIn.toFixed(2));
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
            await writer.writeRecords(dataToWrite);
            console.log("CSV file has been written successfully.");
            try {
                await createAndEmail('total_paid_in_out', 'ProBooks Accounting - Totals Export CSV File', 'totals export csv file');
                console.log('Totals sent via email!');
            } catch (error) {
                console.error("Error sending totals email" + error);
            }
            res.redirect('/admin');
        } catch (error) {
            req.flash('error', 'Error getting transaction types.');
            console.error("Error getting transaction types:", error);
            return res.redirect('/admin');
        }});
});

  app.get('/export-giftaid-claims', requireLogin, checkUserRole, async function(req, res) {
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
        ]});
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
      console.log('Gift Aid Claim sent via email!');
      db.run(`UPDATE donations SET gift_aid_status = 'Claimed' WHERE gift_aid_status = 'Unclaimed'`, function(err) {
        if (err) {
          console.error("Error updating gift_aid_status:", err.message);
        } else {
          console.log("Gift aid status updated successfully.");
        }});
    } catch (error) {
      console.log("Error sending gift aid claim email")
    }});

app.get('/logout', (req, res) => {
    const loggedInName = req.session.name;
        console.log(loggedInName + " user logged out")
        req.session.destroy();
        res.redirect('/');
      });

      app.get("/generate-donor-pdf/:id", requireLogin, checkUserRole, async (req, res) => {
        try {
          const id = req.params.id;
          const donor = await dbHelper.getMemberWithId(id);
          const titheSql = "SELECT * FROM donations WHERE member_id = ? AND date BETWEEN '2021-01-01' AND '2023-12-31' AND fund = 'Tithe' ORDER BY date ASC";
          const donationSql = "SELECT * FROM donations WHERE member_id = ? AND date BETWEEN '2021-01-01' AND '2023-12-31' AND fund != 'Tithe' ORDER BY date ASC";
          Promise.all([
            new Promise((resolve, reject) => {
              db.all(titheSql, [id], (err, tithe) => {
                if (err) {
                  reject(err.message);
                } else {
                  resolve(tithe);
                }
              });
            }),
            new Promise((resolve, reject) => {
              db.all(donationSql, [id], (err, donations) => {
                if (err) {
                  reject(err.message);
                } else {
                  resolve(donations);
                }
              });
            })
          ])
            .then(async ([tithe, donations]) => {
              try {
                const pdfPath = await pdfGenerator.generatePDF(donor, tithe, donations);
                await sendStatementByEmail(pdfPath);
                console.log("Statement of donations sent for: " + donor.first_name);
                req.flash('sucess', 'Statement of donations sent');
                return res.redirect('/claimants');
              } catch (err) {
                console.error("Error generating or sending the statement of donations for donor: " + donor.first_name + err);
                req.flash('error', 'Error generating or sending the statement of donations for donor.');
                return res.redirect('/claimants');
              }})
            .catch((err) => {
              console.error('Error fetching tithe and donation details for donor:', err);
              req.flash('error', 'Error fetching tithe and donation details for donor.');
              return res.redirect('/claimants');
            });
        } catch (error) {
          console.error('Error rendering delete member page:', error);
          req.flash('error', 'Error fetching Donor details.');
          return res.redirect("/claimants")
        }});

        app.get("/generate-transaction-pdf", requireLogin, checkUserRole, (req, res) => {
          try {
            const loggedInName = req.session.name;
            res.render("generate-transaction-pdf", {loggedInName: loggedInName});
          } catch (error) {
            console.error('Error rendering generate transactions page:', error);
            return res.redirect("/admin")
          }});

        app.post("/generate-transaction-pdf", requireLogin, checkUserRole, async (req, res) => {
          try {
            const startDate = req.body.start_date;
            const endDate = req.body.end_date;
            const exportType = req.body.export;
            const email = req.body.email;
            let transactions;
            if (exportType == 'everything') {
              transactions = await dbHelper.getAllTransactionsForPeriod(startDate, endDate);
            } else {
               transactions = await dbHelper.getAllTransactionsWithOnly(startDate, endDate, exportType);
            }
            const pdfPath = await pdfGenerator.generateTransactionPDF(transactions);
            await sendTransactionsEmail(pdfPath, email);
            req.flash('success', 'Transactions PDF generated and sent successfully.');
            return res.redirect('/admin');
          } catch (error) {
            console.error('Error generating or sending transaction PDF:', error);
            req.flash('error', 'Error generating or sending transaction PDF.');
            return res.redirect('/admin');
          }
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
    }});

app.get("/membership", (req, res) => {
  res.render("membership", { member: {}, bank_account: {} });
});

app.post("/membership", async (req, res) => {
  try {
    await dbHelper.addNewMember(req);
    req.flash('success', 'Membership Form completed successfully. Thank You!');
    console.log("Added new member with first name: " + req.body.first_name + " and last name: " + req.body.surname)
    res.redirect("/membership");
  } catch (error) {
    console.error('Error submitting membership form. ' + err.message)
    req.flash('error', 'Error submitting membership form, please try again!');
    res.redirect("/membership");
  }});

  app.get("/addnewtransactiontype", requireLogin, checkUserRole, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const types = await dbHelper.getAllTransactionTypes();
      res.render("addnewtransactiontype", { loggedInName, types });
    } catch (error) {
      console.error('Error rendering addnewtransactiontype page:', error);
      return res.redirect("/admin")
    }});

app.post("/addnewtransactiontype", requireLogin, checkUserRole, async (req, res) => {
  const userInput = req.body.new_transaction_type;
  const loggedInName = req.session.name;
  try {
    const types = await transactionTypes.getAllTransactionTypes();
    if (types.includes(userInput)) {
      console.error(`${userInput} already exists.`);
      req.flash('error', 'Transaction type already exists.');
      return res.redirect("/addnewtransactiontype")
    } else {
      await dbHelper.insertTransactionType(userInput);
      console.log(`${userInput} added successfully by: ` + loggedInName);
      req.flash('success', 'New transaction type added successfully.');
      return res.redirect("/addnewtransactiontype")
    }
  } catch (error) {
    console.error('Error processing new transaction type:', error);
    req.flash('error', 'Error adding transaction type.');
    return res.redirect("/admin")
  }});

app.get("/addnewdonationtype", requireLogin, checkUserRole, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const types = await dbHelper.getAllDonationTypes();
    res.render("addnewdonationtype", { loggedInName, types });
  } catch (error) {
    console.error('Error rendering addnewdonationtype page:', error);
    return res.redirect("/admin")
  }}); 

app.post("/addnewdonationtype", requireLogin, checkUserRole, async (req, res) => {
const userInput = req.body.new_donation_type;
const loggedInName = req.session.name;
try {
  const types = await dbHelper.getAllDonationTypes();
  if (types.includes(userInput)) {
    console.error(`${userInput} already exists.`);
    req.flash('error', 'Donation type already exists.');
    return res.redirect("/addnewdonationtype")
  } else {
    await dbHelper.insertDonationType(userInput);
    console.log(`${userInput} added successfully by: ` + loggedInName);
    req.flash('success', 'New donation type added successfully.');
    return res.redirect("/addnewdonationtype")
  }
} catch (error) {
  console.error('Error processing new donation type:', error);
  req.flash('error', 'Error adding donation type.');
  return res.redirect("/admin")
}});

  app.get("/send-update-request/:id", requireLogin, checkUserRole, async (req, res) => {
    try {
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id);
      if (row && row.email) {
        try {
            emailMemberForUpdate(row);
            console.log('Update details link sent via email for: ' + row.first_name + " " + row.surname);
            req.flash('success', 'Email sent successfully.');
            res.redirect("/edit/" + id);
        } catch (error) {
            console.error("Error sending update email")
            req.flash('error', 'Error sending email to member, try again!.');
            res.redirect("/edit/" + id);
        }} else {
        console.error("Email is blank or null. Cannot send update email for: " + row.first_name + " " + row.surname);
        req.flash('error', 'Email is blank or null. Cannot send update email.');
        res.redirect("/edit/" + id);
    }} catch (error) {
      console.error(error.message);
      return res.redirect("/claimants")
    }});

// Default response for any other request
app.use(function(req, res){
    res.status(404);
    res.redirect('/claimants')
});