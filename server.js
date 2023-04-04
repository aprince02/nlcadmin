var express = require("express")
var app = express()
var db = require("./database.js")
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const fs = require('fs');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const saltRounds = 10;

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
    const claimant = [req.body.first_name, req.body.surname, req.body.date_of_birth, req.body.sort_code, req.body.account_number, id];
    const sql = "UPDATE claimant SET first_name = ?, surname = ?, date_of_birth = ?, sort_code = ?, account_number = ? WHERE (id = ?)";
    db.run(sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Claimant details updated successfully.');
            res.redirect("/claimants");
        }});
    });

// GET /create
app.get("/create", requireLogin, (req, res) => {
    const loggedInName = req.session.name;
    res.render("create", { claimant: {}, bank_account: {} , loggedInName: loggedInName });
  });

// POST /create
app.post("/create", requireLogin, (req, res) => {
    const claimant_sql = "INSERT INTO claimant (first_name, surname, date_of_birth, claim_status, sort_code, account_number) VALUES (?, ?, ?, ?, ?, ?)";
    const status = "ACTIVE";
    const claimant = [req.body.first_name, req.body.surname, req.body.date_of_birth, status,  req.body.sort_code, req.body.account_number];
    db.run(claimant_sql, claimant, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'New claimant added successfully.');
            res.redirect("/claimants");
        }}); 
    });

// GET /delete/id
app.get("/delete/:id", requireLogin, checkUserRole, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const sql = "SELECT * FROM claimant WHERE id = ?";
    db.get(sql, id, (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            res.render("delete", { claimant: row, loggedInName: loggedInName });
        }});
    });

// POST /delete/id
app.post("/delete/:id", requireLogin, checkUserRole, (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM claimant WHERE id = ?";
    db.run(sql, id, err => {
        if (err) {
            console.log(err.message);
        } else {
            req.flash('success', 'Claimant deleted successfully.');
            res.redirect("/claimants");
        }});
    });

// GET /payments/id
app.get("/payments/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const sql = "SELECT * FROM payments WHERE claimant_id = ?";
    db.all(sql, id, (err, rows) => {
        if (err) {
          return console.error(err.message);
        } else {
            res.render("payments", {model: rows, id: id, loggedInName: loggedInName });
        }});
    });

// GET /add-payment/id
app.get("/add-payment/:id", requireLogin, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    const payments_sql = "SELECT * FROM payments WHERE id = ?";
    
    db.get(payments_sql, id, (err, row) => {
        if (err) {
            return console.error(err.message);
        } else {
            res.render("add-payment", { claimant: row, id: id, loggedInName: loggedInName });
        }});
    });
    
// POST /add-payment/id
app.post("/add-payment/:id", requireLogin, (req, res) => {
    const payment_sql = "INSERT INTO payments (claimant_id, amount, date, payment_status) VALUES (?, ?, ?, ?)";
    const pending_status = "PENDING";
    const id = req.params.id;
    const payment = [id, req.body.amount, formatted_date(), pending_status];
    
    db.run(payment_sql, payment, err => {
        if (err) {
            return console.error(err.message);
        } else {
            req.flash('success', 'Payment added successfully.');
            res.redirect("/claimants"); 
        }});
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
            res.redirect('claimants');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }});     
    });
});

// GET /logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
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