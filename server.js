require('dotenv').config();
var express = require("express")
const fs = require('fs');
var app = express()
const pool = require("./database.js")
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const csvWriter = require('csv-writer').createObjectCsvWriter;
const pdfGenerator = require('./pdf-generator');
const { exec } = require('child_process');
const dayjs = require('dayjs');
const path = require('path');
const multer = require('multer');
const schedule = require('node-schedule');
const { requireLogin, checkUserRole, readCSVAndProcess, log, checkSuperAdmin, checkApprovedUser } = require('./utils');
const dbHelper = require('./dbHelper')
const currentYear = new Date().getFullYear();
const csvGenerator = require('./csvGenerator')
const bankRouter   = require('./routes/bank')
const tlSync       = require('./truelayer/sync')
const { sendStatementByEmail, createAndEmail, createAndEmailDBBackup, emailMemberForUpdate, sendTransactionsEmail, sendUpdateSuggestionEmail, sendNewUserAddedEmail, sendDonationReceivedEmail } = require('./emailer');
const fingerprint = require('express-fingerprint');
app.use(fingerprint());
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static("public", { maxAge: "7d" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.use(function(req, res, next){
    res.locals.message = req.flash();
    dbHelper.getDistinctYears().then(years => {
      res.locals.availableYears = years;
      next();
    }).catch(() => {
      res.locals.availableYears = [];
      next();
    });
});
app.use(bankRouter);
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

  app.get("/admin", requireLogin, checkApprovedUser, (req, res) =>  {
    const loggedInName = req.session.name;
    res.render("admin", {loggedInName: loggedInName});
  });

  const membersPerPage = 15;

  app.get("/claimants/:page", requireLogin, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
      try {
          const currentPage = parseInt(req.params.page) || 1;
          const startIndex = (currentPage - 1) * membersPerPage;
          const search = (req.query.search || '').trim();
          let rows, totalCount;
          if (search) {
            rows = await dbHelper.searchMembers(search, startIndex, membersPerPage);
            totalCount = await dbHelper.searchMembersCount(search);
          } else {
            rows = await dbHelper.getMembersPaginated(startIndex, membersPerPage);
            totalCount = await dbHelper.getMembersCount();
          }
          const totalPages = Math.ceil(totalCount / membersPerPage);
          res.render("claimants", { model: rows, loggedInName: loggedInName, currentPage: currentPage, totalPages: totalPages, search: search });
      } catch (error) {
          console.error('Error rendering claimants page:', error);
          log(loggedInName + ': Error rendering claimants page: ' + error);
          return res.redirect("/");
      }
  });

app.get("/yearly-transactions/:year/:page", requireLogin, checkApprovedUser, async (req, res) => {
  const year = req.params.year;
  const rowsPerPage = 100;
  let currentPage = parseInt(req.params.page) || 1;
  if (currentPage < 1) currentPage = 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const loggedInName = req.session.name;
  try {
    const [rowsResult, typesResult, countResult, donationTypesResult] = await Promise.all([
      pool.query('SELECT * FROM transactions WHERE date >= $1 AND date <= $2 ORDER BY date DESC LIMIT $3 OFFSET $4', [startDate, endDate, rowsPerPage, startIndex]),
      pool.query('SELECT type FROM transaction_types'),
      pool.query('SELECT COUNT(*) AS totalrows FROM transactions WHERE date >= $1 AND date <= $2', [startDate, endDate]),
      pool.query('SELECT type FROM donation_types ORDER BY type ASC'),
    ]);
    const totalRows = parseInt(countResult.rows[0].totalrows, 10);
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    res.render('yearly-transactions', {
      row: rowsResult.rows,
      types: typesResult.rows,
      donationTypes: donationTypesResult.rows.map(r => r.type),
      loggedInName,
      currentPage,
      totalPages,
      year,
    });
  } catch (err) {
    console.error(err.message);
    log(loggedInName + ': ' + err.message);
    res.redirect('/admin');
  }
});

app.get("/edit/:id", async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id);
      res.render("edit", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering edit member page:', error);
      log(loggedInName + ': Error rendering edit member page:' + error)
      return res.redirect("/claimants/:page")
    }});

app.post("/edit/:id", async (req, res) => {
    const id = req.params.id;
    const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id];
    const sql = "UPDATE members SET first_name = $1, surname = $2, banking_name = $3, date_of_birth = $4, sex = $5, email = $6, phone_number = $7, address_line_1 = $8, address_line_2 = $9, city = $10, postcode = $11, baptised = $12, baptised_date = $13, holy_spirit = $14, native_church = $15, children_details = $16, emergency_contact_1 = $17, emergency_contact_1_name = $18, emergency_contact_2 = $19, emergency_contact_2_name = $20, occupation_studies = $21, title = $22, house_number = $23, spouse_name = $24 WHERE id = $25";
    try {
        await pool.query(sql, claimant);
        req.flash('success', 'Member details updated successfully.');
        console.log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
        log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
        res.redirect("/claimants/:page");
    } catch (err) {
        console.error(err.message);
        log(err.message);
        res.redirect("/claimants/:page");
    }
    });

    app.get("/edit-member/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const row = await dbHelper.getMemberWithId(id);
        res.render("edit-member", {member: row});
      } catch (error) {
        console.error('Error rendering edit member page:', error);
        log('Error rendering edit member page:' + error)
        res.redirect(`/edit-member/${id}`);
      }});
  
  app.post("/edit-member/:id", async (req, res) => {
      const id = req.params.id;
      const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id];
      const sql = "UPDATE members SET first_name = $1, surname = $2, banking_name = $3, date_of_birth = $4, sex = $5, email = $6, phone_number = $7, address_line_1 = $8, address_line_2 = $9, city = $10, postcode = $11, baptised = $12, baptised_date = $13, holy_spirit = $14, native_church = $15, children_details = $16, emergency_contact_1 = $17, emergency_contact_1_name = $18, emergency_contact_2 = $19, emergency_contact_2_name = $20, occupation_studies = $21, title = $22, house_number = $23, spouse_name = $24 WHERE id = $25";
      try {
          await pool.query(sql, claimant);
          req.flash('success', 'Your details have been updated successfully.');
          console.log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
          log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
          res.redirect(`/edit-member/${id}`);
      } catch (err) {
          console.error(err.message);
          log(err.message);
          res.redirect(`/edit-member/${id}`);
      }
      });

app.get("/create", requireLogin, checkApprovedUser, (req, res) => {
    const loggedInName = req.session.name;
    res.render("create", { member: {}, bank_account: {} , loggedInName: loggedInName });
  });

app.post("/create", requireLogin, checkApprovedUser, async (req, res) => {
  try {
    await dbHelper.addNewMember(req);
    req.flash('success', 'New member added successfully.');
    console.log("Added new member with first name: " + req.body.first_name + " and last name: " + req.body.surname)
    log("Added new member with first name: " + req.body.first_name + " and last name: " + req.body.surname)
    res.redirect("/claimants/:page");
  } catch (error) {
    console.error('Error adding new member. ' + err.message)
    log('Error adding new member. ' + err.message)
    req.flash('error', 'Error adding new member, please try again!');
    res.redirect("/claimants/:page");
  }});

app.get("/delete/:id", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id);
      res.render("delete", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering delete member page:', error);
      return res.redirect("/claimants/:page")
    }});

app.post("/delete/:id", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        await pool.query("DELETE FROM members WHERE id = $1", [id]);
        req.flash('success', 'Member deleted successfully.');
        console.log("Deleted member with id: " + id);
        log(loggedInName + ": Deleted member with id: " + id);
        res.redirect("/claimants/:page");
    } catch (err) {
        console.error(err.message);
        res.redirect("/claimants/:page");
    }
    });

    app.get("/all-donations/:page", requireLogin, checkApprovedUser, async (req, res) => {
      const donationsPerPage = 100;
        const loggedInName = req.session.name;
        const currentPage = parseInt(req.params.page) || 1;
        const startIndex = (currentPage - 1) * donationsPerPage;
        try {
            const [rowsResult, countResult, dtResult] = await Promise.all([
                pool.query('SELECT * FROM donations ORDER BY date DESC LIMIT $1 OFFSET $2', [donationsPerPage, startIndex]),
                pool.query('SELECT COUNT(*) AS totalcount FROM donations'),
                pool.query('SELECT type FROM donation_types ORDER BY type ASC'),
            ]);
            const totalDonations = parseInt(countResult.rows[0].totalcount, 10);
            const totalPages = Math.ceil(totalDonations / donationsPerPage);
            const donationTypes = dtResult.rows.map(r => r.type);
            res.render('all-donations', { model: rowsResult.rows, loggedInName, currentPage, totalPages, donationTypes });
        } catch (err) {
            log(loggedInName + ': ' + err.message);
            console.error(err.message);
            res.redirect('/admin');
        }
    });

app.get("/select-giver", requireLogin, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const rows = await dbHelper.getAllActiveMembers();
    const autoclose = req.query.autoclose === '1' ? '1' : '';
    res.render("select-giver", {row: rows, loggedInName: loggedInName, autoclose});
  } catch (error) {
    console.error('Error rendering select-giver page:', error);
    log(loggedInName + ': Error rendering select-giver page: ' + error )
    return res.redirect("/claimants/:page")
  }});

  function guessFundFromDescription(description, types) {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  // Try partial match
  for (const type of types) {
    if (lowerDesc.includes(type.toLowerCase())) {
      return type;
    }
  }

  // Optional: fallback to first type
  return null;
}

app.get("/donation-added", requireLogin, checkApprovedUser, (req, res) => {
  const loggedInName = req.session.name;
  const autoclose = req.query.autoclose === '1';
  res.render("donation-added", { loggedInName, autoclose });
});

app.get("/add-donation/:id", requireLogin, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const donationDate = req.session.date;
    const donationDescription = req.session.description;
    const donationAmount = req.session.incoming;
    const row = await dbHelper.getMemberWithId(id);
    const types = await dbHelper.getAllDonationTypes();

    const preselectedFund = guessFundFromDescription(donationDescription, types);
    console.log("Preselected fund based on description: " + preselectedFund);

    const autoclose = req.query.autoclose === '1' ? '1' : '';
    res.render("add-donation", {
      row,
      loggedInName,
      donationDate,
      donationAmount,
      donationDescription,
      types,
      preselectedFund,
      autoclose
    });
  } catch (error) {
    console.error('Error rendering add donation page:', error);
    return res.redirect("/claimants/1");
  }
});


app.get("/edit-donation/:id", requireLogin, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const row = await dbHelper.getDonationWithId(id);
    const types = await dbHelper.getAllDonationTypes();
    res.render("edit-donation", { row: row, loggedInName: loggedInName,  types: types});
  } catch (error) {
    console.error('Error rendering edit donation page:', error);
    log(loggedInName + ': Error rendering edit donation page: ' + error)
    return res.redirect("/claimants/:page")
  }});

app.post("/edit-donation/:id", requireLogin, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        await pool.query(
            'UPDATE donations SET date = $1, notes = $2, fund = $3, amount = $4, method = $5 WHERE id = $6',
            [req.body.date, req.body.notes, req.body.fund, req.body.amount, req.body.method, id]
        );
        req.flash('success', 'Donation edited successfully!');
        console.log("Edited donation with id: " + id);
        log(loggedInName + ': Edited donation with id: ' + id);
        res.redirect("/all-donations/:page");
    } catch (err) {
        req.flash('error', 'Error editing donation, please try again!');
        console.error(err.message);
        log(loggedInName + ': Error editing donation: ' + err);
    }
    });

    app.get("/delete-donation/:id", requireLogin, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      const loggedInName = req.session.name;
      try {
          await pool.query('DELETE FROM donations WHERE id = $1', [id]);
          req.flash('success', 'Donation deleted successfully!');
          console.log("Deleted donation with id: " + id);
          log(loggedInName + ': deleted donation with id: ' + id);
          res.redirect("/all-donations/:page");
      } catch (err) {
          req.flash('error', 'Error deleting donation, please try again!');
          console.error(err.message);
          log(loggedInName + ': Error deleting donation: ' + err);
          res.redirect("/all-donations/:page");
      }
      });

      app.post("/add-donation/:id", requireLogin, checkApprovedUser, async (req, res) => {
        const id = req.params.id;
        const loggedInName = req.session.name;
        try {
            await pool.query(
                'INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                [id, req.body.first_name, req.body.surname, req.body.amount, req.body.date, req.body.fund, 'Bank', 'Unclaimed', req.body.notes]
            );
            req.flash('success', 'Donation added successfully.');
            console.log("Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname);
            log(loggedInName + ": Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname);
            try {
                const member = await dbHelper.getMemberWithId(id);
                await sendDonationReceivedEmail(member, req.body);
                log(loggedInName + ": Donation added email sent for: " + member.first_name);
            } catch (emailError) {
                console.error('Error sending donation added email:', emailError.message);
                log(loggedInName + ": Error sending donation added email: " + emailError.message);
            }
            const dest = req.body.autoclose === '1' ? '/donation-added?autoclose=1' : '/select-giver';
            return res.redirect(dest);
        } catch (error) {
            req.flash('error', 'Error adding donation, please try again!');
            console.error('Error adding donation:', error.message);
            log(`${loggedInName}: Error adding donation: ${error.message}`);
            return res.redirect("/select-giver");
        }
    });

app.get("/donations/:id", requireLogin, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        const result = await pool.query('SELECT * FROM donations WHERE member_id = $1 ORDER BY date DESC', [id]);
        const rows = result.rows;
        if (!rows || rows.length === 0) {
            return res.redirect("/no-donations/" + encodeURI(id));
        }
        const firstName = rows[0].first_name || "";
        const surname = rows[0].surname || "";
        let totalAmount = 0;
        rows.forEach((row) => { totalAmount += parseFloat(row.amount) || 0; });
        const dtResult = await pool.query('SELECT type FROM donation_types ORDER BY type ASC');
        const donationTypes = dtResult.rows.map(r => r.type);
        res.render("donations", { model: rows, id, loggedInName, firstName, surname, totalAmount, donationTypes });
    } catch (err) {
        log(loggedInName + ': Error getting donations: ' + err.message);
        console.error(err.message);
        res.redirect("/claimants/1");
    }
    });

app.get("/no-donations/:id", requireLogin, checkApprovedUser, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    res.render("no-donations", { id: id, loggedInName: loggedInName });
    });

app.get("/register", (req, res) =>  {
    res.render("register");
});

app.post("/register", (req, res) => {
    const password = req.body.password;
    bcrypt.genSalt(saltRounds, function(err, salt) {
        bcrypt.hash(password, salt, async function(err, hash) {
            const user = [req.body.username, req.body.email, hash, 'user', req.body.security_question, 'unapproved'];
            try {
                await pool.query(
                    'INSERT INTO users (name, email, password, role, security_question, approval) VALUES ($1,$2,$3,$4,$5,$6)',
                    user
                );
                req.flash('success', 'New account created successfully.');
                log('New account created successfully: ' + req.body.username);
                sendNewUserAddedEmail(user);
                return res.redirect("/login");
            } catch (dbErr) {
                req.flash('error', 'Error registering new account, try again.');
                log('Error registering new account: ' + dbErr.message);
                return res.redirect("/register");
            }
        });
    });
});

    app.post("/save-transaction/:id", requireLogin, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      const type = req.body.type;
      const description = req.body.description;
      const loggedInName = req.session.name;
      const date = req.body.date;
      const paid_in = req.body.paid_in;

      req.session.date = date;
      req.session.description = description;
      req.session.incoming = paid_in;
      req.session.save((err) => {
          if (err) console.error('Failed to save session:', err);
      });

      try {
          await pool.query('UPDATE transactions SET type = $1, description = $2 WHERE id = $3', [type, description, id]);
          console.log(`Transaction with ID: ${id} saved with type: ${type}`);
          log(`${loggedInName}: Transaction with ID: ${id} saved with type: ${type}`);
          req.flash('success', 'Transaction type saved successfully.');

          if (type === "Offering" || type === "Sunday School Offering") {
              try {
                  await pool.query(`
                      INSERT INTO offering_claim (transaction_id, type, date, description, amount, claimed)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      ON CONFLICT (transaction_id) DO UPDATE SET date = EXCLUDED.date, type = EXCLUDED.type, amount = EXCLUDED.amount
                  `, [id, type, date, description, paid_in, 'Unclaimed']);
                  console.log(`Transaction ID ${id} added to offering_claim table.`);
                  log(`${loggedInName}: Transaction ID ${id} added to offering_claim table.`);
              } catch (offerErr) {
                  console.error(`Error inserting into offering_claim: ${offerErr.message}`);
                  log(`${loggedInName}: Error inserting into offering_claim: ${offerErr.message}`);
              }
          }
      } catch (err) {
          req.flash('error', 'Error saving transaction, please try again!');
          console.error(err.message);
          log(loggedInName + ': Error saving transaction: ' + err.message);
      }
  });

app.get("/release-notes", (req, res) =>  {
  res.render("release-notes");
});
    
app.get("/login", (req, res) =>  {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const row = result.rows[0];
        if (!row) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
        bcrypt.compare(password, row.password, function(err, match) {
            if (err) {
                console.error(err.message);
            } else if (match === true) {
                req.session.email = email;
                req.session.name = row.name;
                req.session.role = row.role;
                req.session.approval = row.approval;
                console.log("User " + req.session.name + " logged in");
                const fingerprintData = req.fingerprint;
                console.log(`Logged in user device fingerprint: ${JSON.stringify(fingerprintData)}`);
                log(req.session.name + ': ' + JSON.stringify(fingerprintData));
                res.redirect('claimants');
            } else {
                req.flash('error', 'Invalid email or password.');
                return res.redirect('/login');
            }
        });
    } catch (err) {
        console.error(err.message);
        req.flash('error', 'Login error, please try again.');
        return res.redirect('/login');
    }
});

app.get("/forgot-password", (req, res) =>  {
  res.render("forgot-password");
});

app.post("/forgot-password", async (req, res) => {
  const security_question = req.body.security_question.toLowerCase();
  const new_password = req.body.new_password;
  const email = req.body.email;
  try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) {
          req.flash('error', 'User with this email does not exist.');
          return res.redirect("/forgot-password");
      }
      if (user.security_question.toLowerCase() !== security_question) {
          req.flash('error', 'Security question does not match.');
          log(user.name + ': Security question does not match');
          return res.redirect("/forgot-password");
      }
      bcrypt.genSalt(saltRounds, function(err, salt) {
          bcrypt.hash(new_password, salt, async function(err, hash) {
              if (err) {
                  console.error('Error hashing password:', err);
                  log(user.name + ': Error hashing password:' + err);
                  req.flash('error', 'Error resetting password, try again.');
                  return res.redirect("/forgot-password");
              }
              try {
                  await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hash, email]);
                  req.flash('success', 'Password reset successfully.');
                  log(user.name + ': password reset successfully');
                  return res.redirect("/login");
              } catch (dbErr) {
                  console.error('Error updating password:', dbErr);
                  req.flash('error', 'Error resetting password, try again.');
                  return res.redirect("/forgot-password");
              }
          });
      });
  } catch (err) {
      console.error('Error fetching user:', err);
      log('Error fetching user:' + err);
      req.flash('error', 'Error resetting password, try again.');
      return res.redirect("/forgot-password");
  }
});

app.get('/export-transactions', requireLogin, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  try {
    const result = await pool.query('SELECT * FROM transactions');
    const rows = result.rows;
    const csvWrite = csvWriter({
      path: 'transactions.csv',
      header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
    });
    await csvWrite.writeRecords(rows);
    res.download('transactions.csv');
    try {
      await createAndEmail('transactions', 'ProBooks Accounting - Transactions Export CSV', 'transactions export csv file');
      console.log('Transactions CSV sent via email!');
      log(loggedInName + ': Transactions CSV sent via email');
    } catch (error) {
      console.error("Error sending transactions email" + error);
      log(loggedInName + ": Error sending transactions email" + error);
    }
  } catch (err) {
    req.flash('error', 'Error retrieving data to export transactions.');
    console.error('Error retrieving data for transactions.' + err);
    log(loggedInName + ': Error retrieving data for transactions.' + err);
  }
});

app.get('/export-donations', requireLogin, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  try {
    await csvGenerator.exportDonationsCsv(req, res);
    try {
      await createAndEmail('donations', 'ProBooks Accounting - Donations Export CSV File', 'donations export csv file');
      req.flash('success', 'Donations export sent via email successfully.');
    } catch (error) {
        req.flash('error', 'Unable to send donations export via email.');
        log(loggedInName + ': Unable to send donations export via email' + error)
    }
  } catch (error) {
      req.flash('error', 'Unable to export donations csv');
      log(loggedInName + ': Unable to export donations csv' + error)
  };
  return res.redirect("/admin");
});


  app.get('/db-backup', requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    try {
      await createAndEmailDBBackup();
      console.log('Database backup sent via email!');
      req.flash('success', 'Database backup sent via email successfully.');
      log(loggedInName + ': Database backup sent via email successfully.')
      return res.redirect('/admin')
    } catch (error) {
       console.error("Error sending database backup" + error.message)
      req.flash('error', 'Error sending database backup.');
      log(loggedInName + ': Error sending database backup' + error.message)
      return res.redirect('/admin');
    }});

// TrueLayer bank sync — runs every 6 hours
schedule.scheduleJob('0 */6 * * *', async () => {
  try {
    await tlSync.syncAll();
  } catch (err) {
    console.error('[TrueLayer] Scheduled sync failed:', err.message);
    log('TrueLayer scheduled sync failed: ' + err.message);
  }
});

const scheduledTime = '59 23 * * 0'; // '59 23 * * 0' represents every Sunday at 23:59
schedule.scheduleJob(scheduledTime, async () => {
  try {
    await createAndEmailDBBackup();
    console.log('Database backup sent via email!');
    log('Database scheduled backup sent via email')
  } catch (error) {
    console.error("Error sending database backup: " + error.message);
    log('Error sending scheduled database backup' + error.message)
  }});

app.get("/export-totals", requireLogin, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
    const sql = "SELECT * FROM transactions WHERE date >= '2025-01-01' AND date <= '2025-12-31' ORDER BY type";
    try {
        const result = await pool.query(sql);
        const rows = result.rows;
        const totalPaidInByType = {};
        const totalPaidOutByType = {};
        try {
            const types = await dbHelper.getAllTransactionTypes();
            types.forEach(type => {
                const typeTransactions = rows.filter(row => row.type === type);
                const totalPaidIn = typeTransactions.reduce((total, transaction) => {
                    const paidIn = parseFloat(transaction.paid_in) || 0;
                    if (!isNaN(paidIn)) total += paidIn;
                    return total;
                }, 0);
                const totalPaidOut = typeTransactions.reduce((total, transaction) => {
                    const paidOut = parseFloat(transaction.paid_out) || 0;
                    if (!isNaN(paidOut)) total += paidOut;
                    return total;
                }, 0);
                totalPaidInByType[type] = parseFloat(totalPaidIn.toFixed(2));
                totalPaidOutByType[type] = parseFloat(totalPaidOut.toFixed(2));
            });
            await csvGenerator.writeTotalPaidInOutCsv(types, totalPaidInByType, totalPaidOutByType);
            try {
                await createAndEmail('total_paid_in_out', 'ProBooks Accounting - Totals Export CSV File', 'totals export csv file');
                console.log('Totals sent via email!');
                log(loggedInName + ': Totals export sent via email');
                req.flash('success', 'Totals export sent via email successfully.');
            } catch (error) {
                console.error("Error sending totals email" + error);
                log(loggedInName + ': Error sending totals email ' + error);
                req.flash('error', 'Error sending totals email.');
            }
            res.redirect('/admin');
        } catch (error) {
            req.flash('error', 'Error getting transaction types.');
            log(loggedInName + ': Error getting transaction types: ' + error);
            console.error("Error getting transaction types:", error);
            return res.redirect('/admin');
        }
    } catch (err) {
        req.flash('error', 'Error retrieving data for transactions.');
        log(loggedInName + ': Error retrieving data for transactions export - ' + err.message);
        return res.redirect('/admin');
    }
});

app.get('/export-giftaid-claims', requireLogin, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  try {
    await csvGenerator.exportGiftAidClaimCsv(req, res);
    await createAndEmail('giftaid_claim', 'Gift Aid Claim Export', 'gift aid claim export csv file');
    console.log('Gift Aid Claim sent via email!');
    log(loggedInName + ': Gift Aid Claim sent via email')
    await pool.query(`UPDATE donations SET gift_aid_status = 'Claimed' WHERE gift_aid_status = 'Unclaimed'`);
    console.log("Gift aid status updated successfully.");
    log(loggedInName + ': Gift aid status updated successfully');
    req.flash('success', 'Gift aid claims exported and updated successfully.');
    res.redirect("/admin");
  } catch (error) {
    console.error("Error exporting gift aid claims:", error);
    req.flash('error', 'Error exporting gift aid claims.');
    log(loggedInName + ': Error exporting gift aid claims: ' + error)
    res.redirect("/admin");
  }
});

app.get('/logout', (req, res) => {
    const loggedInName = req.session.name;
        console.log(loggedInName + " user logged out")
        log(loggedInName + ': logged out')
        req.session.destroy();
        res.redirect('/');
      });

      app.get("/generate-donor-pdf/:id", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
        const loggedInName = req.session.name;
        try {
          const id = req.params.id;
          const donor = await dbHelper.getMemberWithId(id);
          const titheSql = "SELECT * FROM donations WHERE member_id = $1 AND date BETWEEN '2024-01-01' AND '2024-12-31' AND fund = 'Tithe' ORDER BY date ASC";
          const donationSql = "SELECT * FROM donations WHERE member_id = $1 AND date BETWEEN '2024-01-01' AND '2024-12-31' AND fund != 'Tithe' ORDER BY date ASC";
          Promise.all([
            pool.query(titheSql, [id]).then(r => r.rows),
            pool.query(donationSql, [id]).then(r => r.rows),
          ])
            .then(async ([tithe, donations]) => {
              try {
                const pdfPath = await pdfGenerator.generatePDF(donor, tithe, donations);
                await sendStatementByEmail(pdfPath);
                req.flash('sucess', 'Statement of donations sent');
                console.log("Statement of donations sent for: " + donor.first_name);
                log(loggedInName + ": Statement of donations sent for: " + donor.first_name)
                return res.redirect('/claimants/:page');
              } catch (err) {
                console.error("Error generating or sending the statement of donations for donor: " + donor.first_name + err);
                log(loggedInName + ": Error generating or sending the statement of donations for donor: " + donor.first_name + err)
                req.flash('error', 'Error generating or sending the statement of donations for donor.');
                return res.redirect('/claimants/:page');
              }})
            .catch((err) => {
              console.error('Error fetching tithe and donation details for donor:', err);
              req.flash('error', 'Error fetching tithe and donation details for donor.');
              log(loggedInName + ': Error fetching tithe and donation details for donor - ', err)
              return res.redirect('/claimants/:page');
            });
        } catch (error) {
          console.error('Error fetching Donor details: ', error);
          req.flash('error', 'Error fetching Donor details.');
          log(loggedInName + ': Error fetching Donor details - ', error)
          return res.redirect("/claimants/:page")
        }});

        app.get("/generate-transaction-pdf", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
          try {
            const loggedInName = req.session.name;
            const types = await dbHelper.getAllTransactionTypes(); // Add await
            res.render("generate-transaction-pdf", { loggedInName: loggedInName, types: types });
          } catch (error) {
            console.error("Error rendering generate transactions page:", error);
            return res.redirect("/admin");
          }
        });
        

        app.post("/generate-transaction-pdf", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
          const loggedInName = req.session.name;
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
            log(loggedInName + ': Transactions PDF generated and sent successfully')
            return res.redirect('/admin');
          } catch (error) {
            console.error('Error generating or sending transactions PDF:', error.message);
            req.flash('error', 'Error generating or sending transaction PDF.');
            log(loggedInName + ': Error generating or sending transaction PDF:', error);
            return res.redirect('/admin');
          }});
        
  
  app.get("/import-transactions", requireLogin, checkUserRole, checkApprovedUser, (req, res) => {
    const loggedInName = req.session.name;
    
    res.render("import-transactions", {loggedInName: loggedInName });
  });

  app.post("/import-transactions", requireLogin, checkUserRole, upload.single('csvfile'), (req, res) => {
    const loggedInName = req.session.name;
    if (!req.file) {
      req.flash('error', 'No file uploaded, try again!');
      log(loggedInName + ': No usable file uploaded')
      console.log("No file")
      return res.redirect('/admin');
    } else {
      readCSVAndProcess(req.file.path, req, res);
      req.flash('success', 'Bank transactions file uploaded and processed successfully');
      log(loggedInName + ': Uploaded bank csv file and processed successfully')
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
    log("Added new member with first name: " + req.body.first_name + " and last name: " + req.body.surname)
    res.redirect("/membership");
  } catch (error) {
    console.error('Error submitting membership form. ' + error.message)
    log('Error submitting membership form: ' + error.message)
    req.flash('error', 'Error submitting membership form, please try again!');
    res.redirect("/membership");
  }});

  app.get("/addnewtransactiontype", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    try {
      const types = await dbHelper.getAllTransactionTypes();
      res.render("addnewtransactiontype", { loggedInName, types });
    } catch (error) {
      console.error('Error rendering addnewtransactiontype page:', error);
      log(loggedInName + ': Error rendering addnewtransactiontype page: ' + error.message)
      return res.redirect("/admin")
    }});

app.post("/addnewtransactiontype", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
  const userInput = req.body.new_transaction_type;
  const loggedInName = req.session.name;
  try {
    const types = await dbHelper.getAllTransactionTypes();
    if (types.includes(userInput)) {
      console.error(`${userInput} already exists.`);
      log(loggedInName + `: ${userInput} already exists in transaction types`)
      req.flash('error', 'Transaction type already exists.');
      return res.redirect("/addnewtransactiontype")
    } else {
      await dbHelper.insertTransactionType(userInput);
      console.log(`${userInput} added successfully by: ` + loggedInName);
      log(loggedInName + `: ${userInput} transaction type added successfully`)
      req.flash('success', 'New transaction type added successfully.');
      return res.redirect("/addnewtransactiontype")
    }
  } catch (error) {
    console.error('Error processing new transaction type:', error);
    log(loggedInName + `: Error processing new transaction type: `, error)
    req.flash('error', 'Error adding transaction type.');
    return res.redirect("/admin")
  }});

app.get("/addnewdonationtype", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const types = await dbHelper.getAllDonationTypes();
    res.render("addnewdonationtype", { loggedInName, types });
  } catch (error) {
    console.error('Error rendering addnewdonationtype page:', error);
    log(loggedInName + ': Error rendering addnewdonationtype page:', error)
    return res.redirect("/admin")
  }});

app.post("/addnewdonationtype", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
const userInput = req.body.new_donation_type;
const loggedInName = req.session.name;
try {
  const types = await dbHelper.getAllDonationTypes();
  if (types.includes(userInput)) {
    console.error(`${userInput} already exists.`);
    req.flash('error', 'Donation type already exists.');
    log(loggedInName + `: ${userInput} donation type already exists`)
    return res.redirect("/addnewdonationtype")
  } else {
    await dbHelper.insertDonationType(userInput);
    console.log(`${userInput} added successfully by: ` + loggedInName);
    log(loggedInName + `: ${userInput} donation type added successfully`)
    req.flash('success', 'New donation type added successfully.');
    return res.redirect("/addnewdonationtype")
  }
} catch (error) {
  console.error('Error processing new donation type:', error);
  req.flash('error', 'Error adding donation type.');
  log(loggedInName + `: Error processing new donation type - ` + error)
  return res.redirect("/admin")
}});

  app.get("/send-update-request/:id", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    const id = req.params.id;
    try {
      const row = await dbHelper.getMemberWithId(id);
      if (row && row.email) {
        try {
            emailMemberForUpdate(row);
            console.log('Update details link sent via email for: ' + row.first_name + " " + row.surname);
            log(loggedInName + ': Update details link sent via email for: ' + row.first_name + " " + row.surname)
            req.flash('success', 'Email sent successfully.');
            res.redirect("/edit/" + id);
        } catch (error) {
            console.error("Error sending update email")
            req.flash('error', 'Error sending email to member, try again!.');
            log(loggedInName + ": Error sending update email - " + error)
            res.redirect("/edit/" + id);
        }} else {
        console.error("Email is blank or null. Cannot send update email for: " + row.first_name + " " + row.surname);
        req.flash('error', 'Email is blank or null. Cannot send update email.');
        log(loggedInName + ": Email is blank or null. Cannot send update email for: " + row.first_name + " " + row.surname)
        res.redirect("/edit/" + id);
    }} catch (error) {
      console.error(error.message);
      log(loggedInName + ": Error retreiving member with ID: " + id + " Error: " + error)
      return res.redirect("/claimants/:page")
    }});

app.get("/update-users", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const users = await dbHelper.getAllUsers();
    res.render("update-users", { loggedInName, users });
  } catch (error) {
    console.error('Error rendering update-users page:', error);
    log(loggedInName + ': Error rendering update-users page:' + error)
    return res.redirect("/admin")
  }});

app.post("/update-users", requireLogin, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  console.log(req.body.approval)
  try {
    const user = await dbHelper.getUserById(req.body.id);
    if (user.role === 'admin' && req.body.role === 'super admin') {
      req.flash('error', 'Admins cannot change their role to Super Admin');
      return res.redirect("/update-users");
    }
    if (user.role === 'user' && req.body.role === 'super admin') {
      req.flash('error', 'User cannot change their role to Super Admin');
      return res.redirect("/update-users");
    }
    if (user.role === 'super admin' && (req.body.role === 'admin' || req.body.role === 'user')) {
      req.flash('error', 'Super Admin role cannot be changed. Please contact the development team if this change is necessary.');
      return res.redirect("/update-users");
    }  
    await dbHelper.updateUser(req);
    req.flash('success', 'User has been updated successfully');
    console.log("Updated user with first name: " + req.body.name + " and email: " + req.body.email + " and role: " + req.body.role)
    log(loggedInName + ": Updated user with first name: " + req.body.name + " and email: " + req.body.email + " and role: " + req.body.role + " and approval: " + req.body.approval) 
    res.redirect("/admin");
  } catch (error) {
    console.error('Error updating user. ' + error.message)
    log(loggedInName + ': Error updating user - ' + error.message)
    req.flash('error', 'Error updating user, please try again!');
    res.redirect("/update-users");
  }});

  app.get("/software-logs/:page", requireLogin, checkSuperAdmin, checkApprovedUser, async (req, res) => {
    const rowsPerPage = 50;
    let currentPage = parseInt(req.params.page) || 1;
    if (currentPage < 1) {
        currentPage = 1;
    }
    const startIndex = (currentPage - 1) * rowsPerPage;
    const loggedInName = req.session.name;
    try {
        const logging = await dbHelper.getLogsPaginated(startIndex, rowsPerPage);
        //const totalRows = await dbHelper.getLogsCount();
        const totalPages = Math.ceil(500 / rowsPerPage);
        res.render("software-logs", { 
            loggedInName, 
            logging,
            currentPage,
            totalPages
        });
    } catch (error) {
        console.error('Error rendering software-logs page:', error);
        log(loggedInName + ': Error rendering software-logs page - ' + error.message)
        return res.redirect("/admin")
    }
});

// ── API: donor search (used by Add Donation modal) ─────────────────
app.get('/api/members/search', requireLogin, checkApprovedUser, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const like = `%${q}%`;
    const result = await pool.query(
      `SELECT id, first_name, surname, banking_name, spouse_name
       FROM members
       WHERE is_active = 1
         AND (first_name ILIKE $1
              OR surname ILIKE $2
              OR (first_name || ' ' || surname) ILIKE $3
              OR spouse_name ILIKE $4
              OR banking_name ILIKE $5)
       ORDER BY first_name ASC
       LIMIT 15`,
      [like, like, like, like, like]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Member search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── API: add donation from modal (JSON) ────────────────────────────
app.post('/api/donations/modal', requireLogin, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  const { member_id, first_name, surname, amount, date, fund, notes, gift_aid_status } = req.body;
  try {
    await pool.query(
      'INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [member_id || null, first_name, surname, amount, date, fund, 'Bank', gift_aid_status || 'Unclaimed', notes || null]
    );
    log(loggedInName + ': Added donation via modal for ' + first_name + ' ' + surname);
    try {
      if (member_id) {
        const member = await dbHelper.getMemberWithId(member_id);
        await sendDonationReceivedEmail(member, req.body);
      }
    } catch (emailErr) {
      console.error('Donation email error:', emailErr.message);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Modal donation error:', err.message);
    log(loggedInName + ': Modal donation error: ' + err.message);
    res.status(500).json({ success: false, error: 'Failed to save donation.' });
  }
});

app.get("/suggest-update", requireLogin, checkApprovedUser, (req, res) => {
  const loggedInName = req.session.name;
  res.render("suggest-update", { loggedInName });
});

app.get("/select-inactive", requireLogin, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const result = await pool.query("SELECT * FROM members ORDER BY first_name ASC");
    res.render("select-inactive", { loggedInName, row: result.rows });
  } catch (err) {
    console.error("Error fetching donors:", err);
    return res.status(500).send("Database error.");
  }
});


app.post('/deactivate-donors', async (req, res) => {
  const selectedIds = req.body.selectedIds || [];
  const deactivateIds = Array.isArray(selectedIds) ? selectedIds : [selectedIds];

  const client = await pool.connect();
  try {
    const allResult = await client.query('SELECT id FROM members');
    const allIds = allResult.rows.map(row => row.id.toString());
    const activateIds = allIds.filter(id => !deactivateIds.includes(id));

    await client.query('BEGIN');

    if (deactivateIds.length > 0) {
      const placeholders = deactivateIds.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`UPDATE members SET is_active = 0 WHERE id IN (${placeholders})`, deactivateIds);
    }

    if (activateIds.length > 0) {
      const placeholders = activateIds.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`UPDATE members SET is_active = 1 WHERE id IN (${placeholders})`, activateIds);
    }

    await client.query('COMMIT');
    res.redirect('/admin');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', err);
    return res.status(500).send('Database error');
  } finally {
    client.release();
  }
});

app.get('/dashboard', requireLogin, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const now = new Date();
    const todayYear = now.getFullYear();
    const selectedYear = parseInt(req.query.year) || todayYear;
    const currentYear = selectedYear;

    // For "this month" KPIs we always use today's actual month, but scoped to the selected year
    // If viewing a past year, show full-year totals in the KPI instead of a partial month
    const isCurrentYear = selectedYear === todayYear;
    const kpiMonth = isCurrentYear ? now.getMonth() + 1 : 12;
    const currentYM = `${currentYear}-${String(kpiMonth).padStart(2, '0')}`;
    const prevDate = new Date(currentYear, kpiMonth - 2, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const [
      transactions, donations,
      currentMonthTotals, prevMonthTotals,
      ytdDonationTotal, monthlyDonationCount,
      activeMembers,
      recentTransactions, recentDonations, topDonors
    ] = await Promise.all([
      dbHelper.getAllTransactionsForYear(currentYear),
      dbHelper.getAllDonationsForYear(currentYear),
      dbHelper.getMonthlyTotals(currentYM),
      dbHelper.getMonthlyTotals(prevYM),
      dbHelper.getYTDDonationTotal(currentYear),
      dbHelper.getMonthlyDonationCount(currentYM),
      dbHelper.getMembersCount(),
      dbHelper.getRecentTransactions(5),
      dbHelper.getRecentDonations(5),
      dbHelper.getTopDonors(currentYear, 5)
    ]);

    const pctChange = (curr, prev) => {
      if (!prev || prev === 0) return null;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const monthlyData = dbHelper.generateMonthlyData(transactions);
    const fundBreakdown = dbHelper.generateFundBreakdown(donations);

    res.render('dashboard', {
      loggedInName,
      currentYear,
      todayYear,
      isCurrentYear,
      currentMonthTotals,
      paidInChange:  pctChange(currentMonthTotals.paidIn,  prevMonthTotals.paidIn),
      paidOutChange: pctChange(currentMonthTotals.paidOut, prevMonthTotals.paidOut),
      ytdDonationTotal,
      monthlyDonationCount,
      activeMembers,
      recentTransactions,
      recentDonations,
      topDonors,
      barChartData: JSON.stringify(monthlyData),
      pieChartData: JSON.stringify(fundBreakdown)
    });
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    res.status(500).send('Server error');
  }
});

app.post("/suggest-update", requireLogin, checkApprovedUser, (req, res) => {
  const loggedInName = req.session.name;
  const suggestion = req.body.update_suggestion;
  try {
    sendUpdateSuggestionEmail(suggestion, loggedInName);
    log(loggedInName + ': Update suggestion email sent by user')
    req.flash('success', 'Email sent successfully.');
    res.redirect("/admin");
} catch (error) {
    req.flash('error', 'Error sending email to administrator, try again!.');
    log(loggedInName + ": Error sending update suggestion email - " + error)
    res.redirect("/admin");
}}); requireLogin,

// Default response for any other request
app.use(function(req, res){
    res.status(404);
    res.redirect('/claimants/:page')
});