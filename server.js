var express = require("express")
var app = express()
var db = require("./database.js")
const session = require('express-session');
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const fs = require('fs');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const { timeStamp } = require("console");
const saltRounds = 10;
const csvWriter = require('csv-writer').createObjectCsvWriter;
const generatePDF = require('./pdf-generator');
const { exec } = require('child_process');
const path = require('path');

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
// Start server
app.listen(8000, () => {
    console.log("Server running on port: %PORT%".replace("%PORT%",8000))
});
// Root endpoint
app.get("/", (req, res) =>  {
    res.render("index");
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
    const claimant = [req.body.first_name, req.body.surname, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, id];
    const sql = "UPDATE members SET first_name = ?, surname = ?, date_of_birth = ?, sex = ?, email = ?, phone_number = ?, address_line_1 = ?, address_line_2 = ?, city = ?, postcode = ?, baptised = ?, baptised_date = ?, holy_spirit = ?, native_church = ?, children_details = ?, emergency_contact_1 = ?, emergency_contact_1_name = ?, emergency_contact_2 = ?, emergency_contact_2_name = ?, occupation_studies = ?, title = ?, house_number = ?  WHERE (id = ?)";
    db.run(sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Member details updated successfully.');
            log(req, "Updated details for member with ID: " + id + " and first name: " + req.body.first_name)
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
    const claimant_sql = "INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name, emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const claimant = [req.body.first_name, req.body.surname, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.date_of_birth, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number,];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'New member added successfully.');
            log(req, "Added new member with first name: " + req.body.first_name + "and last name: " + req.body.surname)
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
            log(req, "Deleted member with id: " + id)
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
    console.log(req.session.date)
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
            console.log(err.message);
        } else {
            log(req, "Edited donation with id: " + id)
            res.redirect("/all-donations");
        }}); 
    });

// POST /add-payment/id
app.post("/add-donation/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const payment_sql = "INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status) VALUES (?,?,?,?,?,?,?,?)";
    const status = "Unclaimed";
    const payment = [id, req.body.first_name, req.body.surname, req.body.amount, req.body.date, req.body.fund, req.body.method, status];
    
    db.run(payment_sql, payment, err => {
        if (err) {
            return console.error(err.message);
        } else {
            req.flash('success', 'Donation added successfully.');
            log(req, "Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname)
            res.redirect("/select-giver"); 
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
            console.log(rows)
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
    req.session.date = req.body.date;
    req.session.description = req.body.description;
    req.session.incoming = req.body.paid_in;
    req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
        }
      });

    const claimant_sql = "UPDATE transactions SET type = ? WHERE (id = ?)";
    const claimant = [type, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Type saved successfully.');
            log(req, "Transaction with id: " + id + " saved with type:" + type)
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
                    req.session.timestamp = row.timestamp;
                    req.session.user = row.user;
                    log(req, "User " + req.session.name + " logged in");
                }
            });

            res.redirect('claimants');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }});     
    });
});

app.get('/export-transactions', checkUserRole, function(req, res) {
  const tableName = 'transactions';
  
  db.all(`SELECT * FROM ${tableName}`, function(err, rows) {
    if (err) {
      res.status(500).send('Error retrieving data');
      return;
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
        res.status(500).send('Error generating CSV file');
      });
  });
});

app.get('/export-donations', checkUserRole, function(req, res) {
    const tableName = 'donations';
    
    db.all(`SELECT * FROM ${tableName}`, function(err, rows) {
      if (err) {
        res.status(500).send('Error retrieving data');
        return;
      }
      
      const csvWrite = csvWriter({
        path: 'donations.csv',
        header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
      });
      
      csvWrite.writeRecords(rows)
        .then(() => {
          res.download('donations.csv');
        })
        .catch(() => {
          res.status(500).send('Error generating CSV file');
        });
    });
  });

  app.get("/export-totals", checkUserRole, function(req, res) {

    const sql = "SELECT * FROM transactions WHERE date >= '2023-01-01' ORDER BY type";
  
  db.all(sql, function(err, rows) {
    if (err) {
      res.status(500).send('Error retrieving data');
      return;
    }

    // Calculate the total "Paid In" for each type of transaction
    const types = [
        'Tithe', 'Offering', 'Church Building', 'Vehicle', 'Building Rent',
        'Ladies Fund', 'Sunday School Offering', 'Guest Pastor', 'Support & Charity',
        'Audio/Visual/Licenses', 'Books & Stationary', 'Provisions', 'Gifts', 'Other Income',
        'Gift Aid Claim', 'VBS', 'Evangelism', 'AoG', 'Legal', 'Anniversary',
        'Membership Interest Free Loan'
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
      console.error("Error writing CSV file:", err);
      res.status(500).send('Error exporting data to CSV.');
    });
});
});


  app.get('/export-giftaid-claims', checkUserRole, function(req, res) {
  
    db.all(`SELECT members.first_name, members.surname, donations.amount, donations.date, 
      members.title, members.house_number, members.postcode
      FROM donations 
      INNER JOIN members ON donations.member_id = members.id 
      WHERE donations.gift_aid_status = 'Unclaimed'`, function(err, rows) {
      if (err) {
        res.status(500).send('Error retrieving data');
        return;
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
          res.status(500).send('Error generating CSV file');
        });
    });
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
          const scriptPath = path.join(__dirname, 'ProBooksAccountingPush.bat');

        log(req, "User logged out")
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
            generatePDF(donor, tithe, donations);
          })
          .catch((err) => {
            console.log(err);
          });
      }
    });
  });
  
// POST /import-transactions
app.get("/import-transactions", requireLogin, checkUserRole, (req, res) => {
   
    readCSVAndProcess();
  });

// Default response for any other request
app.use(function(req, res){
    res.status(404);
    res.redirect('/claimants')
});

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

function log(req, update) {
  const sql = "INSERT INTO console_logs (timestamp, user, log_message) VALUES (datetime('now'), ?, ?)";
  const loggedInName = req.session.name;
  const data = [loggedInName, update];

  db.run(sql, data, err => {
    if (err) {
      console.error(err.message);
      return;
    }
  });
}


 // Assuming your CSV file is named 'data.csv'
 const csvFilePath = __dirname + "/data.csv";

 // Function to read the CSV file and process its contents
 function readCSVAndProcess() {
   const results = [];
   
   fs.createReadStream(csvFilePath)
     .pipe(csv())
     .on('data', (data) => {
        data.Date = convertDateFormat(data.Date);
       results.push(data);
     })
     .on('end', () => {
       // 'results' array now contains the data from the CSV file
       // Process the data and save it to the database as needed
       // For example:
       results.forEach(row => {
         // Save the 'row' data to the 'transactions' table in your SQLite database
         // Modify the code here to save the data into your 'transactions' table
         // Example:
         const sql = "INSERT INTO transactions (date, transaction_type, type, description, paid_out, paid_in, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
         const params = [row.Date, row.Type, null, row.Description, row['Paid Out'], row['Paid In'], row.Balance, null];
         
         db.run(sql, params, (err) => {
           if (err) {
             console.error("Error inserting row into the database:", err.message);
           } else {
             console.log("Row inserted successfully:", row);
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
    } else {
        req.flash('error', 'Only Admins are allowed to delete claimants.');
        res.redirect('/claimants');
    }}