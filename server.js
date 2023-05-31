var express = require("express")
var app = express()
var db = require("./database.js")
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const fs = require('fs');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const { timeStamp } = require("console");
const saltRounds = 10;
const csvWriter = require('csv-writer').createObjectCsvWriter;

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
    const sql = "SELECT * FROM members ORDER BY id ASC"
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
            res.redirect("/claimants");
        }}); 
    });

// POST /save-transactions
app.post("/save-transaction/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const type = req.body.type;
    const outgoing = req.body.paid_out; 
    const incoming = req.body.paid_in;
    console.log(outgoing)
    console.log(incoming)
    console.log(id)
    console.log(req.body.type)
    const claimant_sql = "UPDATE transactions SET type = ? WHERE (id = ?)";
    const claimant = [req.body.type, id];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Type saved successfully.');
            if (type == 'Tithe') {
                console.log("type was tithe")
            }

            //res.redirect("/yearly-transactions");
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
    const sql = "SELECT * FROM members ORDER BY id ASC"
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
    const loggedInName = req.session.name;
    db.get(sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("add-donation", { row: row, loggedInName: loggedInName});
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
            console.log(rows[0])
            const firstName = rows[0].first_name || "";
            const surname = rows[0].surname || "";

            res.render("donations", {model: rows, id: id, loggedInName: loggedInName, firstName: firstName, surname: surname });
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
            req.session.destroy();
            res.redirect('/');
        }});
    
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

function requireLogin(req, res, next) {
    if (req.session && req.session.email) {
        // user is logged in, so continue with the next middleware
        next();
    } else {
        // user is not logged in, so redirect to login page
        res.redirect('/login');
    }}

function checkUserRole(req, res, next) {
    if (req.session.role === 'admin') {
        // if the logged in users role is admin, continue with the next middleware
        next();
    } else {
        // user is not admin, so redirect to claimants page
        req.flash('error', 'Only Admins are allowed to delete claimants.');
        res.redirect('/claimants');
    }}