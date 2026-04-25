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
const crypto = require('crypto');
const dayjs = require('dayjs');
const path = require('path');
const multer = require('multer');
const schedule = require('node-schedule');

// Only register cron jobs on the host that should actually run them (set RUN_CRONS=true on the production server).
// This stops dev machines from racing the production server when they share the same database.
const CRONS_ENABLED = process.env.RUN_CRONS === 'true';
if (!CRONS_ENABLED) {
  console.log('[cron] disabled — set RUN_CRONS=true in .env to enable scheduled jobs');
}
function scheduleJob(cronExpr, jobName, handler) {
  if (!CRONS_ENABLED) return;
  console.log('[cron] registering', jobName, '→', cronExpr);
  schedule.scheduleJob(cronExpr, handler);
}
const { requireLogin, injectCharityId, checkUserRole, readCSVAndProcess, log, checkSuperAdmin, checkApprovedUser, checkAdmin, checkPlatformAdmin, formatPostcode, isLikelyPlaceholderEmail } = require('./utils');
const dbHelper = require('./dbHelper')
const currentYear = new Date().getFullYear();
const csvGenerator = require('./csvGenerator')
const bankRouter        = require('./routes/bank')
const invitesRouter     = require('./routes/invites')
const superAdminRouter  = require('./routes/superadmin')
const tlSync            = require('./truelayer/sync')
const { sendStatementByEmail, sendDonorStatementBuffer, createAndEmail, emailMemberForUpdate, sendDonationReceivedEmail, sendTotalsExportEmail, sendTransactionsPDFBuffer, sendDonationsPDFBuffer, sendPaymentFailedEmail, sendGiftAidSubmissionRequestEmail } = require('./emailer');
const fingerprint = require('express-fingerprint');
app.use(fingerprint());
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static("public", { maxAge: "7d" }));

// Stripe webhook — must be mounted BEFORE express.json() so the raw body is available for signature verification
const billing = require('./billing');
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = billing.constructEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    await billing.handleEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err.message);
    res.status(500).json({ error: 'Webhook handler error' });
  }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
if (!process.env.SESSION_SECRET) {
    throw new Error('Missing SESSION_SECRET. Set it in .env');
}
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use(flash());
app.use(function(req, res, next){
    res.locals.message = req.flash();
    res.locals.platformActingAs = req.session?.platformActingAs || null;
    res.locals.userRole = req.session?.role || null;
    const charityId = req.session?.charityId;
    if (charityId) {
      dbHelper.getDistinctYears(charityId).then(years => {
        res.locals.availableYears = years;
        next();
      }).catch(() => {
        res.locals.availableYears = [];
        next();
      });
    } else {
      res.locals.availableYears = [];
      next();
    }
});
// Global subscription gate for state-changing requests
// Blocks writes when the charity's subscription is canceled/unpaid.
// Exemptions: not-logged-in, webhook, billing routes, logout.
const SUBSCRIPTION_EXEMPT_PATHS = [
  /^\/webhooks\//,
  /^\/charity\/billing/,
  /^\/api\/billing\//,
  /^\/logout/,
  /^\/invite\//,
  /^\/update-details\//,
  /^\/login/,
  /^\/forgot-password/,
  /^\/membership/,
  /^\/platform/,
];
app.use(async function (req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (!req.session?.charityId) return next(); // unauthenticated — let auth middleware handle it
  if (req.session?.role === 'platform_admin') return next(); // platform admins bypass the gate
  if (SUBSCRIPTION_EXEMPT_PATHS.some(rx => rx.test(req.path))) return next();
  try {
    const r = await pool.query('SELECT subscription_status FROM charities WHERE id = $1', [req.session.charityId]);
    const status = r.rows[0]?.subscription_status;
    if (billing.isActive(status)) return next();
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(402).json({ error: 'Your subscription is not active. Please update billing to continue.' });
    }
    req.flash('error', 'Your subscription is not active. Please update billing to continue.');
    return res.redirect('/charity/billing');
  } catch (err) {
    console.error('Subscription gate error:', err.message);
    next(); // fail-open on DB errors
  }
});

app.use(bankRouter);
app.use(invitesRouter);
app.use(superAdminRouter);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }});

const upload = multer({ storage: storage });

// Logo upload — stored in public/uploads/logos so it is web-accessible
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public', 'uploads', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, 'charity-logo-' + Date.now() + path.extname(file.originalname));
  },
});
const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

app.listen(8000, () => {
  console.log("Server running on port: %PORT%".replace("%PORT%",8000))
});

  app.get('/docs', requireLogin, (req, res) => {
    res.render('docs', { loggedInName: req.session.name });
  });

  app.get("/admin", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    try {
      const [transactionTypes, donationTypes, unclaimed, thisMonth, lastClaim] = await Promise.all([
        dbHelper.getAllTransactionTypes(req.charityId),
        dbHelper.getAllDonationTypes(req.charityId),
        pool.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::NUMERIC), 0)::float AS total
           FROM donations WHERE gift_aid_status = 'Unclaimed' AND charity_id = $1`,
          [req.charityId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::NUMERIC), 0)::float AS total
           FROM donations
           WHERE charity_id = $1
             AND date >= date_trunc('month', CURRENT_DATE)
             AND date <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`,
          [req.charityId]
        ),
        pool.query(
          `SELECT claimed_at, record_count, total_amount
           FROM gift_aid_claims WHERE charity_id = $1 ORDER BY claimed_at DESC LIMIT 1`,
          [req.charityId]
        ),
      ]);
      const stats = {
        unclaimed: unclaimed.rows[0],
        thisMonth: thisMonth.rows[0],
        lastClaim: lastClaim.rows[0] || null,
      };
      res.render("admin", { loggedInName, transactionTypes, donationTypes, stats, isSuperAdmin: req.session.role === 'super admin' });
    } catch (err) {
      console.error('Error loading admin page:', err.message);
      res.render("admin", { loggedInName, transactionTypes: [], donationTypes: [], stats: null, isSuperAdmin: req.session.role === 'super admin' });
    }
  });

  const membersPerPage = 15;

  app.get("/claimants/:page", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
      try {
          const currentPage = parseInt(req.params.page) || 1;
          const startIndex = (currentPage - 1) * membersPerPage;
          const search = (req.query.search || '').trim();
          let rows, totalCount;
          if (search) {
            rows = await dbHelper.searchMembers(search, startIndex, membersPerPage, req.charityId);
            totalCount = await dbHelper.searchMembersCount(search, req.charityId);
          } else {
            rows = await dbHelper.getMembersPaginated(startIndex, membersPerPage, req.charityId);
            totalCount = await dbHelper.getMembersCount(req.charityId);
          }
          const totalPages = Math.ceil(totalCount / membersPerPage);
          res.render("claimants", { model: rows, loggedInName: loggedInName, currentPage: currentPage, totalPages: totalPages, search: search });
      } catch (error) {
          console.error('Error rendering claimants page:', error);
          log(loggedInName + ': Error rendering claimants page: ' + error);
          return res.redirect("/");
      }
  });

app.get("/yearly-transactions/:year/:page", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
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
      pool.query('SELECT * FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3 ORDER BY date DESC LIMIT $4 OFFSET $5', [startDate, endDate, req.charityId, rowsPerPage, startIndex]),
      pool.query('SELECT type FROM transaction_types WHERE charity_id = $1', [req.charityId]),
      pool.query('SELECT COUNT(*) AS totalrows FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3', [startDate, endDate, req.charityId]),
      pool.query('SELECT type FROM donation_types WHERE charity_id = $1 ORDER BY type ASC', [req.charityId]),
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

app.get("/edit/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id, req.charityId);
      if (!row) return res.status(404).redirect("/claimants/1");
      res.render("edit", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering edit member page:', error);
      log('Error rendering edit member page:' + error, req.charityId);
      return res.redirect("/claimants/1")
    }});

app.post("/edit/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const doNotEmail = req.body.do_not_email === '1' || req.body.do_not_email === 'on' || req.body.do_not_email === true;
    const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, doNotEmail, id, req.charityId];
    const sql = "UPDATE members SET first_name = $1, surname = $2, banking_name = $3, date_of_birth = $4, sex = $5, email = $6, phone_number = $7, address_line_1 = $8, address_line_2 = $9, city = $10, postcode = $11, baptised = $12, baptised_date = $13, holy_spirit = $14, native_church = $15, children_details = $16, emergency_contact_1 = $17, emergency_contact_1_name = $18, emergency_contact_2 = $19, emergency_contact_2_name = $20, occupation_studies = $21, title = $22, house_number = $23, spouse_name = $24, do_not_email = $25 WHERE id = $26 AND charity_id = $27";
    try {
        await pool.query(sql, claimant);
        req.flash('success', 'Member details updated successfully.');
        console.log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
        log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name, req.charityId);
        res.redirect("/claimants/1");
    } catch (err) {
        console.error(err.message);
        log(err.message, req.charityId);
        res.redirect("/claimants/1");
    }
    });

    app.get("/edit-member/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      try {
        const row = await dbHelper.getMemberWithId(id, req.charityId);
        if (!row) {
          req.flash('error', 'Member not found.');
          return res.redirect('/claimants/1');
        }
        res.render("edit-member", { member: row });
      } catch (error) {
        console.error('Error rendering edit member page:', error);
        log('Error rendering edit member page: ' + error.message);
        req.flash('error', 'Could not load member details.');
        res.redirect('/claimants/1');
      }
    });

  app.post("/edit-member/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      const claimant = [req.body.first_name, req.body.surname, req.body.banking_name, req.body.date_of_birth, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, formatPostcode(req.body.postcode), req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number, req.body.spouse_name, id, req.charityId];
      const sql = "UPDATE members SET first_name = $1, surname = $2, banking_name = $3, date_of_birth = $4, sex = $5, email = $6, phone_number = $7, address_line_1 = $8, address_line_2 = $9, city = $10, postcode = $11, baptised = $12, baptised_date = $13, holy_spirit = $14, native_church = $15, children_details = $16, emergency_contact_1 = $17, emergency_contact_1_name = $18, emergency_contact_2 = $19, emergency_contact_2_name = $20, occupation_studies = $21, title = $22, house_number = $23, spouse_name = $24 WHERE id = $25 AND charity_id = $26";
      try {
          await pool.query(sql, claimant);
          req.flash('success', 'Your details have been updated successfully.');
          console.log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
          log("Updated details for member with ID: " + id + " and first name: " + req.body.first_name);
          res.redirect(`/edit-member/${id}`);
      } catch (err) {
          console.error(err.message);
          log(err.message);
          req.flash('error', 'Could not save changes.');
          res.redirect(`/edit-member/${id}`);
      }
      });

app.get("/create", requireLogin, checkApprovedUser, (req, res) => {
    const loggedInName = req.session.name;
    res.render("create", { member: {}, bank_account: {} , loggedInName: loggedInName });
  });

app.post("/create", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    await dbHelper.addNewMember(req, req.charityId);
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

app.get("/delete/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
    try {
      const loggedInName = req.session.name;
      const id = req.params.id;
      const row = await dbHelper.getMemberWithId(id, req.charityId);
      if (!row) return res.status(404).redirect("/claimants/1");
      res.render("delete", {member: row, loggedInName: loggedInName});
    } catch (error) {
      console.error('Error rendering delete member page:', error);
      return res.redirect("/claimants/1")
    }});

app.post("/delete/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        await pool.query("DELETE FROM members WHERE id = $1 AND charity_id = $2", [id, req.charityId]);
        req.flash('success', 'Member deleted successfully.');
        console.log("Deleted member with id: " + id);
        log(loggedInName + ": Deleted member with id: " + id, req.charityId);
        res.redirect("/claimants/1");
    } catch (err) {
        console.error(err.message);
        res.redirect("/claimants/1");
    }
    });

    app.get("/all-donations/:page", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
      const donationsPerPage = 100;
        const loggedInName = req.session.name;
        const currentPage = parseInt(req.params.page) || 1;
        const startIndex = (currentPage - 1) * donationsPerPage;
        try {
            const [rowsResult, countResult, dtResult] = await Promise.all([
                pool.query('SELECT * FROM donations WHERE charity_id = $1 ORDER BY date DESC LIMIT $2 OFFSET $3', [req.charityId, donationsPerPage, startIndex]),
                pool.query('SELECT COUNT(*) AS totalcount FROM donations WHERE charity_id = $1', [req.charityId]),
                pool.query('SELECT type FROM donation_types WHERE charity_id = $1 ORDER BY type ASC', [req.charityId]),
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

app.get("/select-giver", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const rows = await dbHelper.getAllActiveMembers(req.charityId);
    const autoclose = req.query.autoclose === '1' ? '1' : '';
    res.render("select-giver", {row: rows, loggedInName: loggedInName, autoclose});
  } catch (error) {
    console.error('Error rendering select-giver page:', error);
    log(loggedInName + ': Error rendering select-giver page: ' + error )
    return res.redirect("/claimants/:page")
  }});

  /** Safely escape a value for CSV output (RFC 4180). */
  function escapeCsvField(value) {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

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

app.get("/donation-added", requireLogin, injectCharityId, checkApprovedUser, (req, res) => {
  const loggedInName = req.session.name;
  const autoclose = req.query.autoclose === '1';
  res.render("donation-added", { loggedInName, autoclose });
});

app.get("/add-donation/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const donationDate = req.session.date;
    const donationDescription = req.session.description;
    const donationAmount = req.session.incoming;
    const row = await dbHelper.getMemberWithId(id, req.charityId);
    if (!row) return res.status(404).redirect("/claimants/1");
    const types = await dbHelper.getAllDonationTypes(req.charityId);

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


app.get("/edit-donation/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    const loggedInName = req.session.name;
    const id = req.params.id;
    const row = await dbHelper.getDonationWithId(id, req.charityId);
    if (!row) return res.status(404).redirect("/all-donations/1");
    const types = await dbHelper.getAllDonationTypes(req.charityId);
    res.render("edit-donation", { row: row, loggedInName: loggedInName,  types: types});
  } catch (error) {
    console.error('Error rendering edit donation page:', error);
    log(loggedInName + ': Error rendering edit donation page: ' + error)
    return res.redirect("/claimants/:page")
  }});

app.post("/edit-donation/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        await pool.query(
            'UPDATE donations SET date = $1, notes = $2, fund = $3, amount = $4, method = $5 WHERE id = $6 AND charity_id = $7',
            [req.body.date, req.body.notes, req.body.fund, req.body.amount, req.body.method, id, req.charityId]
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

    app.get("/delete-donation/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      const loggedInName = req.session.name;
      try {
          await pool.query('DELETE FROM donations WHERE id = $1 AND charity_id = $2', [id, req.charityId]);
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

      app.post("/add-donation/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
        const id = req.params.id;
        const loggedInName = req.session.name;
        try {
            await pool.query(
                'INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes, charity_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
                [id, req.body.first_name, req.body.surname, req.body.amount, req.body.date, req.body.fund, 'Bank', 'Unclaimed', req.body.notes, req.charityId]
            );
            req.flash('success', 'Donation added successfully.');
            console.log("Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname);
            log(loggedInName + ": Added donation for member with id: " + id + ", and name: " + req.body.first_name + " " + req.body.surname);
            try {
                const member = await dbHelper.getMemberWithId(id, req.charityId);
                const charity = await dbHelper.getCharityById(req.charityId);
                await sendDonationReceivedEmail(member, req.body, charity?.name);
                log(loggedInName + ": Donation added email sent for: " + member.first_name, req.charityId);
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

// ── Member API (used by claimants page modals) ──────────────────────────────
app.get("/api/member/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    const member = await dbHelper.getMemberWithId(req.params.id, req.charityId);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    // Attach donation summary
    const totals = await pool.query(
      `SELECT COALESCE(SUM(amount::FLOAT),0) AS total, COUNT(*) AS count FROM donations WHERE member_id=$1 AND charity_id=$2`,
      [req.params.id, req.charityId]
    );
    const recent = await pool.query(
      `SELECT date, fund, amount FROM donations WHERE member_id=$1 AND charity_id=$2 ORDER BY date DESC LIMIT 5`,
      [req.params.id, req.charityId]
    );
    res.json({ member, total: totals.rows[0].total, count: totals.rows[0].count, recent: recent.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/member/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const id = req.params.id;
  const b = req.body;
  const doNotEmail = b.do_not_email === true || b.do_not_email === '1' || b.do_not_email === 'on';
  const vals = [b.first_name, b.surname, b.banking_name, b.date_of_birth, b.sex, b.email, b.phone_number, b.address_line_1, b.address_line_2, b.city, formatPostcode(b.postcode), b.baptised, b.baptised_date, b.holy_spirit, b.native_church, b.children_details, b.emergency_contact_1, b.emergency_contact_1_name, b.emergency_contact_2, b.emergency_contact_2_name, b.occupation_studies, b.title, b.house_number, b.spouse_name, doNotEmail, id, req.charityId];
  try {
    await pool.query(
      `UPDATE members SET first_name=$1,surname=$2,banking_name=$3,date_of_birth=$4,sex=$5,email=$6,phone_number=$7,address_line_1=$8,address_line_2=$9,city=$10,postcode=$11,baptised=$12,baptised_date=$13,holy_spirit=$14,native_church=$15,children_details=$16,emergency_contact_1=$17,emergency_contact_1_name=$18,emergency_contact_2=$19,emergency_contact_2_name=$20,occupation_studies=$21,title=$22,house_number=$23,spouse_name=$24,do_not_email=$25 WHERE id=$26 AND charity_id=$27`,
      vals
    );
    log(req.session.name + ': Updated member ' + id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/member/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const id = req.params.id;
  const allowed = ['title', 'first_name', 'surname', 'house_number', 'postcode'];
  const fields = [];
  const vals   = [];
  let idx = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const val = key === 'postcode' ? formatPostcode(req.body[key]) : req.body[key];
      fields.push(`${key}=$${idx++}`);
      vals.push(val);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });
  vals.push(id, req.charityId);
  try {
    await pool.query(
      `UPDATE members SET ${fields.join(',')} WHERE id=$${idx++} AND charity_id=$${idx}`,
      vals
    );
    log(req.session.name + ': Updated member ' + id + ' (gift aid review)');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/member/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM members WHERE id=$1 AND charity_id=$2", [id, req.charityId]);
    log(req.session.name + ': Deleted member ' + id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/donations/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    try {
        const result = await pool.query('SELECT * FROM donations WHERE member_id = $1 AND charity_id = $2 ORDER BY date DESC', [id, req.charityId]);
        const rows = result.rows;
        if (!rows || rows.length === 0) {
            return res.redirect("/no-donations/" + encodeURI(id));
        }
        const firstName = rows[0].first_name || "";
        const surname = rows[0].surname || "";
        let totalAmount = 0;
        rows.forEach((row) => { totalAmount += parseFloat(row.amount) || 0; });
        const dtResult = await pool.query('SELECT type FROM donation_types WHERE charity_id = $1 ORDER BY type ASC', [req.charityId]);
        const donationTypes = dtResult.rows.map(r => r.type);
        const memberResult = await pool.query('SELECT email FROM members WHERE id = $1 AND charity_id = $2', [id, req.charityId]);
        const donorEmail = memberResult.rows[0]?.email || '';
        res.render("donations", { model: rows, id, loggedInName, firstName, surname, totalAmount, donationTypes, donorEmail });
    } catch (err) {
        log(loggedInName + ': Error getting donations: ' + err.message);
        console.error(err.message);
        res.redirect("/claimants/1");
    }
    });

app.get("/no-donations/:id", requireLogin, injectCharityId, checkApprovedUser, (req, res) => {
    const id = req.params.id;
    const loggedInName = req.session.name;
    res.render("no-donations", { id: id, loggedInName: loggedInName });
    });


app.get("/register", (req, res) => res.redirect("/login"));

app.get("/privacy-policy", (_, res) => res.render("privacy-policy"));
app.get("/terms-and-conditions", (_, res) => res.render("terms-and-conditions"));

    app.post("/save-transaction/:id", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
      const id = req.params.id;
      const type = req.body.type;
      const description = req.body.description;
      const loggedInName = req.session.name;
      const rawDate = req.body.date;
      // Extract YYYY-MM-DD without any timezone conversion
      const date = rawDate ? rawDate.trim().slice(0, 10) : null;
      const paid_in = req.body.paid_in;

      req.session.date = date;
      req.session.description = description;
      req.session.incoming = paid_in;
      req.session.save((err) => {
          if (err) console.error('Failed to save session:', err);
      });

      try {
          await pool.query('UPDATE transactions SET type = $1, description = $2 WHERE id = $3 AND charity_id = $4', [type, description, id, req.charityId]);
          console.log(`Transaction with ID: ${id} saved with type: ${type}`);
          log(`${loggedInName}: Transaction with ID: ${id} saved with type: ${type}`, req.charityId);
          res.json({ success: true });
      } catch (err) {
          console.error(err.message);
          log(loggedInName + ': Error saving transaction: ' + err.message);
          res.status(500).json({ success: false });
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
                req.session.email     = email;
                req.session.name      = row.name;
                req.session.role      = row.role;
                req.session.approval  = row.approval;
                req.session.charityId = row.charity_id;
                console.log("User " + req.session.name + " logged in");
                const fingerprintData = req.fingerprint;
                console.log(`Logged in user device fingerprint: ${JSON.stringify(fingerprintData)}`);
                log(req.session.name + ': ' + JSON.stringify(fingerprintData));
                if (row.role === 'platform_admin') {
                    return res.redirect('/platform');
                }
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

app.get('/export-transactions', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  try {
    const result = await pool.query('SELECT * FROM transactions WHERE charity_id = $1', [req.charityId]);
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

app.post('/export-donations', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const { fund, start_date, end_date, action, email_to } = req.body;

    if (action === 'email' && !email_to) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    // Build query with optional filters — always scoped to charity
    let query = 'SELECT * FROM donations WHERE charity_id = $1';
    const params = [req.charityId];
    let idx = 2;
    if (start_date)             { query += ` AND date >= $${idx++}`; params.push(start_date); }
    if (end_date)               { query += ` AND date <= $${idx++}`; params.push(end_date); }
    if (fund && fund !== 'all') { query += ` AND fund = $${idx++}`;  params.push(fund); }
    query += ' ORDER BY date DESC';

    const result = await pool.query(query, params);
    const charity = await dbHelper.getCharityById(req.charityId);
    const pdfBuffer = await pdfGenerator.generateDonationsPDF(result.rows, { fund, startDate: start_date, endDate: end_date }, charity);

    const date     = new Date().toISOString().slice(0, 10);
    const fundSlug = fund && fund !== 'all' ? `_${fund.replace(/[^a-z0-9]/gi, '_')}` : '';
    const filename = `donations_export${fundSlug}_${date}.pdf`;

    if (action === 'email') {
      await sendDonationsPDFBuffer(email_to, pdfBuffer, filename);
      log(`${loggedInName}: Donations PDF emailed to ${email_to} (${result.rows.length} rows)`);
      return res.json({ success: true, message: `Donations PDF emailed to ${email_to}.` });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
    log(`${loggedInName}: Donations PDF downloaded (${result.rows.length} rows)`);
  } catch (error) {
    console.error('Error generating donations PDF:', error.message);
    log(`${loggedInName}: Error generating donations PDF: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'Error generating PDF.' });
  }
});


  app.get('/db-backup', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    try {
      // Discover all tables in the public schema
      const tablesResult = await pool.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename ASC
      `);
      const tables = tablesResult.rows.map(r => r.tablename);

      const date = new Date().toISOString().slice(0, 10);
      const filename = `database_export_${date}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      for (const table of tables) {
        try {
          // Table name comes from pg_tables (schemaname = 'public') — safe, no injection risk
          const result = await pool.query(`SELECT * FROM "${table}"`);
          const headers = result.fields.map(f => f.name);
          const lines = [headers.map(escapeCsvField).join(',')];
          for (const row of result.rows) {
            lines.push(headers.map(h => escapeCsvField(row[h])).join(','));
          }
          archive.append(lines.join('\n') + '\n', { name: `${table}.csv` });
        } catch (tableErr) {
          console.error(`DB export: error on table "${table}":`, tableErr.message);
          log(`${loggedInName}: DB export error on table "${table}": ${tableErr.message}`);
          // Continue with remaining tables
        }
      }

      await archive.finalize();
      log(`${loggedInName}: Database CSV export downloaded (${tables.length} tables).`);
    } catch (error) {
      console.error('DB export: fatal error:', error.message);
      log(`${loggedInName}: DB export fatal error: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).send('Error generating database export.');
      }
    }
  });

// TrueLayer bank sync — runs every 6 hours for all active charities
scheduleJob('0 */6 * * *', 'truelayer-sync', async () => {
  try {
    const pool = require('./database');
    const { rows: charities } = await pool.query(
      `SELECT id FROM charities WHERE is_active = 1`
    );
    for (const charity of charities) {
      try {
        await tlSync.syncAll(charity.id);
      } catch (err) {
        console.error(`[TrueLayer] Scheduled sync failed for charity ${charity.id}:`, err.message);
        log(`TrueLayer scheduled sync failed for charity ${charity.id}: ` + err.message);
      }
    }
  } catch (err) {
    console.error('[TrueLayer] Scheduled sync: failed to fetch charities:', err.message);
  }
});


app.post("/export-totals", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  const { start_date, end_date, email, action } = req.body;
  const mode = action || (email ? 'email' : 'download');

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Date range is required.' });
  }
  if (mode === 'email' && !email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3 ORDER BY type',
      [start_date, end_date, req.charityId]
    );
    const rows = result.rows;
    const types = await dbHelper.getAllTransactionTypes(req.charityId);

    const totalPaidInByType  = {};
    const totalPaidOutByType = {};
    types.forEach(type => {
      const txns = rows.filter(r => r.type === type);
      totalPaidInByType[type]  = parseFloat(txns.reduce((t, r) => t + (parseFloat(r.paid_in)  || 0), 0).toFixed(2));
      totalPaidOutByType[type] = parseFloat(txns.reduce((t, r) => t + (parseFloat(r.paid_out) || 0), 0).toFixed(2));
    });

    const csvFilename = `totals_export_${start_date}_to_${end_date}.csv`;
    const pdfFilename = `totals_export_${start_date}_to_${end_date}.pdf`;

    const buildCsvBuffer = () => {
      const csvLines = ['Type,Paid In,Paid Out'];
      types.forEach(type => {
        csvLines.push(`${escapeCsvField(type)},${totalPaidInByType[type]},${totalPaidOutByType[type]}`);
      });
      return Buffer.from(csvLines.join('\n') + '\n', 'utf8');
    };

    if (mode === 'download_csv') {
      const csvBuffer = buildCsvBuffer();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
      res.send(csvBuffer);
      log(`${loggedInName}: Totals CSV downloaded`);
      return;
    }

    // Build PDF in memory (needed for PDF download and email)
    const charity = await dbHelper.getCharityById(req.charityId);
    const pdfBuffer = await pdfGenerator.generateTotalsPDF(types, totalPaidInByType, totalPaidOutByType, { startDate: start_date, endDate: end_date }, charity);

    if (mode === 'email') {
      const csvBuffer = buildCsvBuffer();
      await sendTotalsExportEmail(email, csvBuffer, pdfBuffer, csvFilename, pdfFilename);
      console.log(`Totals export sent to ${email}`);
      log(`${loggedInName}: Totals export (CSV + PDF) sent to ${email}`);
      return res.json({ success: true, message: `Totals export sent to ${email}.` });
    }

    // Default: download the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
    res.send(pdfBuffer);
    log(`${loggedInName}: Totals PDF downloaded`);
  } catch (err) {
    console.error('Error generating totals export:', err.message);
    log(`${loggedInName}: Error generating totals export: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'Error generating totals export.' });
  }
});

app.get('/api/giftaid-summary', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount::NUMERIC), 0) AS total
       FROM donations
       WHERE gift_aid_status = 'Unclaimed' AND charity_id = $1`,
      [req.charityId]
    );

    const donationCount = parseInt(result.rows[0].count);
    const donationTotal = parseFloat(result.rows[0].total);
    const receivable    = parseFloat((donationTotal * 0.25).toFixed(2));

    res.json({
      donationCount,
      donationTotal: donationTotal.toFixed(2),
      receivable:    receivable.toFixed(2),
    });
  } catch (err) {
    console.error('Gift aid summary error:', err.message);
    res.status(500).json({ error: 'Could not load gift aid summary.' });
  }
});

app.get('/api/giftaid-preview', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        members.id AS member_id,
        members.title,
        members.first_name,
        members.surname AS last_name,
        members.house_number AS house_name_or_number,
        members.postcode,
        donations.amount,
        donations.date
      FROM donations
      INNER JOIN members ON donations.member_id = members.id
      WHERE donations.gift_aid_status = 'Unclaimed'
        AND donations.charity_id = $1
      ORDER BY members.surname, members.first_name, donations.date
    `, [req.charityId]);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('Gift aid preview error:', err.message);
    res.status(500).json({ error: 'Could not load preview.' });
  }
});

app.post('/export-giftaid-claims', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async function(req, res) {
  const loggedInName = req.session.name;
  try {
    const { csvBuffer, donationIds, recordCount, totalAmount } = await csvGenerator.exportGiftAidClaimCsv(req);

    if (recordCount === 0) {
      return res.status(400).json({ error: 'No complete records to export. Please fix the highlighted rows.' });
    }

    // Persist the claim batch and link the claimed donations to it
    const claimResult = await pool.query(
      `INSERT INTO gift_aid_claims (charity_id, claimed_by, record_count, total_amount, csv_content)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, claimed_at`,
      [req.charityId, loggedInName, recordCount, totalAmount, csvBuffer.toString('utf8')]
    );
    const claimId = claimResult.rows[0].id;

    await pool.query(
      `UPDATE donations SET gift_aid_status = 'Claimed', gift_aid_claim_id = $1
       WHERE id = ANY($2::int[]) AND charity_id = $3`,
      [claimId, donationIds, req.charityId]
    );

    log(`${loggedInName}: Gift Aid claim #${claimId} exported (${recordCount} records, £${totalAmount})`, req.charityId);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="giftaid_claim_${date}.csv"`);
    res.send(csvBuffer);
  } catch (error) {
    console.error("Error exporting gift aid claims:", error);
    log(loggedInName + ': Error exporting gift aid claims: ' + error);
    if (!res.headersSent) res.status(500).json({ error: 'Error exporting gift aid claims.' });
  }
});

app.get('/api/giftaid-claims', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, claimed_at, claimed_by, record_count, total_amount,
              submission_status, submission_fee_amount, submitted_at
       FROM gift_aid_claims WHERE charity_id = $1 ORDER BY claimed_at DESC`,
      [req.charityId]
    );
    res.json({ claims: result.rows });
  } catch (err) {
    console.error('Gift aid claims list error:', err.message);
    res.status(500).json({ error: 'Could not load claim history.' });
  }
});

app.get('/api/giftaid-claims/:id/csv', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT csv_content, claimed_at FROM gift_aid_claims WHERE id = $1 AND charity_id = $2`,
      [req.params.id, req.charityId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim not found.' });
    const { csv_content, claimed_at } = result.rows[0];
    const date = new Date(claimed_at).toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="giftaid_claim_${date}.csv"`);
    res.send(csv_content);
  } catch (err) {
    console.error('Gift aid claim download error:', err.message);
    res.status(500).json({ error: 'Could not download claim.' });
  }
});

// Quote the submission-service fee for the current unclaimed batch (1%, £25 floor, £200 cap)
app.get('/api/giftaid-submission/quote', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount::NUMERIC), 0)::float AS total
       FROM donations d
       INNER JOIN members m ON d.member_id = m.id
       WHERE d.gift_aid_status = 'Unclaimed'
         AND d.charity_id = $1
         AND m.first_name IS NOT NULL AND m.surname IS NOT NULL
         AND m.house_number IS NOT NULL AND m.postcode IS NOT NULL`,
      [req.charityId]
    );
    const total = parseFloat(result.rows[0].total) || 0;
    const receivable = parseFloat((total * 0.25).toFixed(2));
    const fee = billing.calcGiftAidSubmissionFee(receivable);
    res.json({ total, receivable, fee });
  } catch (err) {
    console.error('Gift aid fee quote error:', err.message);
    res.status(500).json({ error: 'Could not calculate fee.' });
  }
});

// Paid submission: charge the on-file card, persist the claim, email the CSV to the operator
app.post('/api/giftaid-submission/submit', requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const { csvBuffer, donationIds, recordCount, totalAmount } = await csvGenerator.exportGiftAidClaimCsv(req);
    if (recordCount === 0) {
      return res.status(400).json({ error: 'No complete records to submit. Please fix the highlighted rows.' });
    }
    const receivable = parseFloat((totalAmount * 0.25).toFixed(2));
    const fee = billing.calcGiftAidSubmissionFee(receivable);

    // Charge the card on file before committing anything
    let intent;
    try {
      intent = await billing.chargeOneOff({
        charityId: req.charityId,
        amountGBP: fee,
        description: `Gift Aid submission service (${recordCount} records)`,
        metadata: { charity_id: String(req.charityId), purpose: 'gift_aid_submission' },
      });
    } catch (err) {
      console.error('Gift aid submission payment failed:', err.message);
      return res.status(402).json({ error: err.message || 'Payment failed. Please check your billing details.' });
    }

    // Persist the claim with submission metadata
    const claimResult = await pool.query(
      `INSERT INTO gift_aid_claims (
         charity_id, claimed_by, record_count, total_amount, csv_content,
         submission_status, submission_fee_amount, submission_stripe_charge_id
       ) VALUES ($1, $2, $3, $4, $5, 'submission_requested', $6, $7)
       RETURNING id, claimed_at`,
      [req.charityId, loggedInName, recordCount, totalAmount, csvBuffer.toString('utf8'), fee, intent.id]
    );
    const claimId = claimResult.rows[0].id;

    await pool.query(
      `UPDATE donations SET gift_aid_status = 'Claimed', gift_aid_claim_id = $1
       WHERE id = ANY($2::int[]) AND charity_id = $3`,
      [claimId, donationIds, req.charityId]
    );

    // Fire-and-forget operator email (don't block the response)
    const charity = await dbHelper.getCharityById(req.charityId);
    const date = new Date().toISOString().slice(0, 10);
    const csvFilename = `giftaid_claim_${date}.csv`;
    Promise.resolve().then(() =>
      sendGiftAidSubmissionRequestEmail({
        charityName: charity?.name || `charity #${req.charityId}`,
        claimId, recordCount, receivable, fee,
        csvBuffer, csvFilename,
        adminUrl: `${process.env.APP_URL || ''}/platform`,
      })
    ).catch(err => console.error('Operator notification email failed:', err.message));

    log(`${loggedInName}: Paid Gift Aid submission requested — claim #${claimId}, fee £${fee}, receivable £${receivable}`, req.charityId);
    res.json({ success: true, claimId, fee, receivable, recordCount, message: `Submission scheduled. £${fee.toFixed(2)} charged. We'll submit within 2 business days.` });
  } catch (err) {
    console.error('Gift aid submission error:', err.message);
    res.status(500).json({ error: err.message || 'Submission failed.' });
  }
});

// Platform admin — cross-charity list of Gift Aid claims with filter & action
app.get('/platform/giftaid-claims', requireLogin, checkPlatformAdmin, async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toLowerCase();
    let whereSql = '';
    const params = [];
    if (status === 'pending') {
      whereSql = `WHERE gac.submission_status = 'submission_requested'`;
    } else if (status === 'submitted') {
      whereSql = `WHERE gac.submission_status = 'submitted'`;
    } else if (status === 'paid') {
      whereSql = `WHERE gac.submission_status IN ('submission_requested', 'submitted')`;
    } // 'all' falls through to no filter
    const result = await pool.query(`
      SELECT gac.id, gac.claimed_at, gac.claimed_by, gac.record_count, gac.total_amount,
             gac.submission_status, gac.submission_fee_amount, gac.submitted_at,
             c.name AS charity_name, c.id AS charity_id
      FROM gift_aid_claims gac
      INNER JOIN charities c ON c.id = gac.charity_id
      ${whereSql}
      ORDER BY gac.claimed_at DESC
    `, params);
    res.render('platform/giftaid-claims', { loggedInName: req.session.name, claims: result.rows, status });
  } catch (err) {
    console.error('Platform gift-aid-claims error:', err.message);
    res.status(500).send('Error loading claims.');
  }
});

// Platform admin marks a claim as actually submitted to HMRC
app.post('/api/giftaid-claims/:id/mark-submitted', requireLogin, checkPlatformAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE gift_aid_claims SET submission_status = 'submitted', submitted_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark-submitted error:', err.message);
    res.status(500).json({ error: 'Could not mark claim as submitted.' });
  }
});

// Keep GET redirect for any bookmarked links
app.get('/export-giftaid-claims', (req, res) => res.redirect('/admin'));

// ── Platform admin (cross-charity operator) ───────────────────────────────
app.get('/platform', requireLogin, checkPlatformAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.name, c.slug, c.subscription_status, c.subscription_plan, c.current_period_end,
        (SELECT COUNT(*) FROM users  WHERE charity_id = c.id AND approval = 'approved')::int AS user_count,
        (SELECT COUNT(*) FROM members WHERE charity_id = c.id)::int AS member_count,
        (SELECT MAX(date)::text FROM donations WHERE charity_id = c.id) AS last_donation_at
      FROM charities c
      ORDER BY c.name ASC
    `);
    res.render('platform/index', { loggedInName: req.session.name, charities: result.rows });
  } catch (err) {
    console.error('Platform index error:', err.message);
    res.status(500).send('Error loading platform view.');
  }
});

app.get('/platform/dashboard', requireLogin, checkPlatformAdmin, async (req, res) => {
  try {
    const [users, subs, lastSync, errors] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE approval = 'approved'`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int      AS active,
          COUNT(*) FILTER (WHERE subscription_status = 'past_due')::int   AS past_due,
          COUNT(*) FILTER (WHERE subscription_status IN ('canceled','unpaid'))::int AS cancelled,
          COUNT(*) FILTER (WHERE subscription_status IS NULL)::int        AS none
        FROM charities
      `),
      pool.query(`SELECT MAX(last_synced_at)::text AS last_synced FROM bank_connections`).catch(() => ({ rows: [{ last_synced: null }] })),
      pool.query(`SELECT COUNT(*)::int AS n FROM console_logs WHERE level = 'error' AND timestamp::timestamptz > NOW() - INTERVAL '24 hours'`),
    ]);
    res.render('platform/dashboard', {
      loggedInName: req.session.name,
      activeUsers: users.rows[0].n,
      subs: subs.rows[0],
      lastBankSync: lastSync.rows[0].last_synced,
      recentErrors: errors.rows[0].n,
    });
  } catch (err) {
    console.error('Platform dashboard error:', err.message);
    res.status(500).send('Error loading platform dashboard.');
  }
});

// "Act as" — platform admin scopes themselves to a specific charity
app.post('/platform/act-as/:charityId', requireLogin, checkPlatformAdmin, async (req, res) => {
  const charityId = parseInt(req.params.charityId, 10);
  try {
    const result = await pool.query('SELECT id, name FROM charities WHERE id = $1', [charityId]);
    if (result.rows.length === 0) {
      req.flash('error', 'Charity not found.');
      return res.redirect('/platform');
    }
    req.session.charityId       = charityId;
    req.session.platformActingAs = { id: charityId, name: result.rows[0].name };
    req.session.approval        = 'approved'; // platform admins are implicitly approved when acting as
    log(req.session.name + ': platform admin acting as charity ' + charityId);
    res.redirect('/claimants/1');
  } catch (err) {
    console.error('Act-as error:', err.message);
    req.flash('error', 'Could not switch to that charity.');
    res.redirect('/platform');
  }
});

app.get('/platform/exit-acting', requireLogin, checkPlatformAdmin, (req, res) => {
  delete req.session.charityId;
  delete req.session.platformActingAs;
  res.redirect('/platform');
});

// ── Billing (Stripe) ───────────────────────────────────────────────────────
app.get('/charity/billing', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, subscription_status, subscription_plan, current_period_end, stripe_subscription_id
       FROM charities WHERE id = $1`, [req.charityId]
    );
    const charity = result.rows[0];
    res.render('billing', { charity, loggedInName: req.session.name });
  } catch (err) {
    console.error('Billing page error:', err.message);
    req.flash('error', 'Could not load billing page.');
    res.redirect('/admin');
  }
});

app.post('/api/billing/checkout', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  try {
    const plan = req.body.plan;
    const base = process.env.APP_URL || (`${req.protocol}://${req.get('host')}`);
    const url = await billing.createCheckoutSession({
      charityId:  req.charityId,
      plan,
      successUrl: `${base}/charity/billing?checkout=success`,
      cancelUrl:  `${base}/charity/billing?checkout=cancelled`,
    });
    res.json({ url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(500).json({ error: err.message || 'Could not create checkout session.' });
  }
});

app.post('/api/billing/portal', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  try {
    const base = process.env.APP_URL || (`${req.protocol}://${req.get('host')}`);
    const url = await billing.createPortalSession({
      charityId: req.charityId,
      returnUrl: `${base}/charity/billing`,
    });
    res.json({ url });
  } catch (err) {
    console.error('Portal session error:', err.message);
    res.status(500).json({ error: err.message || 'Could not open billing portal.' });
  }
});

// Daily payment reminder for past_due / unpaid subscriptions
scheduleJob('0 9 * * *', 'payment-reminders', async () => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM charities WHERE subscription_status IN ('past_due', 'unpaid')`
    );
    const base = process.env.APP_URL || 'https://probooksaccounting.co.uk';
    for (const charity of result.rows) {
      const admins = await pool.query(
        `SELECT email FROM users
         WHERE charity_id = $1 AND approval = 'approved' AND role IN ('admin', 'super admin')
           AND email IS NOT NULL`,
        [charity.id]
      );
      for (const u of admins.rows) {
        try {
          await sendPaymentFailedEmail(u.email, charity.name, `${base}/charity/billing`);
        } catch (err) {
          console.error('Payment reminder email failed for', u.email, ':', err.message);
        }
      }
      await pool.query('UPDATE charities SET last_payment_reminder_sent_at = NOW() WHERE id = $1', [charity.id]);
    }
  } catch (err) {
    console.error('Payment reminder cron error:', err.message);
  }
});

app.get('/logout', (req, res) => {
    const loggedInName = req.session.name;
        console.log(loggedInName + " user logged out")
        log(loggedInName + ': logged out')
        req.session.destroy();
        res.redirect('/');
      });

      // ── Charity Settings ────────────────────────────────────────────
      app.get("/charity/settings", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
        const loggedInName = req.session.name;
        try {
          const charity = await dbHelper.getCharityById(req.charityId);
          res.render("charity-settings", { loggedInName, charity });
        } catch (err) {
          console.error('Error loading charity settings:', err.message);
          req.flash('error', 'Could not load charity settings.');
          res.redirect('/admin');
        }
      });

      app.post("/charity/settings", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
        const loggedInName = req.session.name;
        try {
          const { name, email, phone, website, charity_no, treasurer_name, address } = req.body;
          await dbHelper.updateCharity(req.charityId, { name, email, phone, website, charity_no, treasurer_name, address });
          log(loggedInName + ': Updated charity settings');
          req.flash('success', 'Charity settings updated.');
          res.redirect('/charity/settings');
        } catch (err) {
          console.error('Error updating charity settings:', err.message);
          req.flash('error', 'Could not update charity settings.');
          res.redirect('/charity/settings');
        }
      });

      app.post("/charity/settings/logo", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, logoUpload.single('logo'), async (req, res) => {
        const loggedInName = req.session.name;
        try {
          if (!req.file) {
            req.flash('error', 'No file uploaded.');
            return res.redirect('/charity/settings');
          }
          // Store path relative to the public folder so it's web-accessible
          const webPath = '/uploads/logos/' + req.file.filename;
          await dbHelper.updateCharityLogo(req.charityId, webPath);
          log(loggedInName + ': Updated charity logo to ' + webPath);
          req.flash('success', 'Charity logo updated.');
          res.redirect('/charity/settings');
        } catch (err) {
          console.error('Error uploading charity logo:', err.message);
          req.flash('error', 'Could not upload logo.');
          res.redirect('/charity/settings');
        }
      });

      // ── Donor PDF (modal-driven: download or email with date range) ─
      app.post("/api/donor-pdf/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
        const loggedInName = req.session.name;
        try {
          const id = req.params.id;
          const { start_date, end_date, action, email_to } = req.body;

          if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start and end date are required.' });
          }

          const donor = await dbHelper.getMemberWithId(id, req.charityId);
          if (!donor) return res.status(404).json({ error: 'Donor not found.' });

          const [tithe, donations] = await Promise.all([
            pool.query(
              `SELECT * FROM donations WHERE member_id=$1 AND charity_id=$2 AND date BETWEEN $3 AND $4 AND fund='Tithe' ORDER BY date ASC`,
              [id, req.charityId, start_date, end_date]
            ).then(r => r.rows),
            pool.query(
              `SELECT * FROM donations WHERE member_id=$1 AND charity_id=$2 AND date BETWEEN $3 AND $4 AND fund!='Tithe' ORDER BY date ASC`,
              [id, req.charityId, start_date, end_date]
            ).then(r => r.rows),
          ]);

          if (tithe.length === 0 && donations.length === 0) {
            return res.status(200).json({ empty: true, message: 'No donations found in the selected date range.' });
          }

          const charity = await dbHelper.getCharityById(req.charityId);
          const pdfBuffer = await pdfGenerator.generatePDF(donor, tithe, donations, charity, start_date, end_date);
          const fullName = `${donor.first_name} ${donor.surname}`;

          if (action === 'email') {
            if (!email_to) return res.status(400).json({ error: 'Email address is required.' });
            await sendDonorStatementBuffer(email_to, pdfBuffer, fullName);
            log(loggedInName + ': Donor PDF emailed to ' + email_to + ' for ' + fullName);
            return res.json({ success: true, message: `Statement emailed to ${email_to}.` });
          }

          // Default: download
          const filename = `${fullName} - Statement of Donations.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          log(loggedInName + ': Donor PDF downloaded for ' + fullName);
          return res.send(pdfBuffer);
        } catch (err) {
          console.error('Error generating donor PDF:', err.message);
          log(loggedInName + ': Error generating donor PDF: ' + err.message);
          if (!res.headersSent) res.status(500).json({ error: 'Error generating PDF.' });
        }
      });

      app.get("/generate-donor-pdf/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
        const loggedInName = req.session.name;
        try {
          const id = req.params.id;
          const donor = await dbHelper.getMemberWithId(id, req.charityId);
          if (!donor) return res.status(404).redirect("/claimants/1");
          const titheSql = "SELECT * FROM donations WHERE member_id = $1 AND charity_id = $2 AND date BETWEEN '2024-01-01' AND '2024-12-31' AND fund = 'Tithe' ORDER BY date ASC";
          const donationSql = "SELECT * FROM donations WHERE member_id = $1 AND charity_id = $2 AND date BETWEEN '2024-01-01' AND '2024-12-31' AND fund != 'Tithe' ORDER BY date ASC";
          Promise.all([
            pool.query(titheSql, [id, req.charityId]).then(r => r.rows),
            pool.query(donationSql, [id, req.charityId]).then(r => r.rows),
          ])
            .then(async ([tithe, donations]) => {
              try {
                const charity = await dbHelper.getCharityById(req.charityId);
                const pdfPath = await pdfGenerator.generatePDF(donor, tithe, donations, charity);
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

        app.post("/generate-transaction-pdf", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
          const loggedInName = req.session.name;
          try {
            const { start_date, end_date, export: exportType, action, email_to } = req.body;

            if (action === 'email' && !email_to) {
              return res.status(400).json({ error: 'Email address is required.' });
            }

            let transactions;
            if (exportType === 'everything') {
              transactions = await dbHelper.getAllTransactionsForPeriod(start_date, end_date, req.charityId);
            } else {
              transactions = await dbHelper.getAllTransactionsWithOnly(start_date, end_date, exportType, req.charityId);
            }
            const pdfBuffer = await pdfGenerator.generateTransactionPDF(transactions);
            const filename  = `transactions_${start_date}_to_${end_date}.pdf`;

            if (action === 'email') {
              await sendTransactionsPDFBuffer(email_to, pdfBuffer, filename);
              log(loggedInName + ': Transactions PDF emailed to ' + email_to);
              return res.json({ success: true, message: `Transactions PDF emailed to ${email_to}.` });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
            log(loggedInName + ': Transactions PDF downloaded');
          } catch (error) {
            console.error('Error generating transactions PDF:', error.message);
            log(loggedInName + ': Error generating transactions PDF: ' + error.message);
            if (!res.headersSent) res.status(500).json({ error: 'Error generating PDF.' });
          }
        });
        
  
  app.get("/import-transactions", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, (req, res) => {
    const loggedInName = req.session.name;
    
    res.render("import-transactions", {loggedInName: loggedInName });
  });

  app.post("/import-transactions", requireLogin, injectCharityId, checkUserRole, upload.single('csvfile'), async (req, res) => {
    const loggedInName = req.session.name;
    if (!req.file) {
      req.flash('error', 'No file uploaded, try again!');
      log(loggedInName + ': No usable file uploaded');
      return res.redirect('/admin');
    }
    log(loggedInName + ': Uploaded bank CSV for import', req.charityId);
    await readCSVAndProcess(req.file.path, req, res);
  });

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

  app.get("/addnewtransactiontype", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    try {
      const types = await dbHelper.getAllTransactionTypes(req.charityId);
      res.render("addnewtransactiontype", { loggedInName, types });
    } catch (error) {
      console.error('Error rendering addnewtransactiontype page:', error);
      log(loggedInName + ': Error rendering addnewtransactiontype page: ' + error.message)
      return res.redirect("/admin")
    }});

app.post("/addnewtransactiontype", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const userInput = req.body.new_transaction_type;
  const loggedInName = req.session.name;
  try {
    const types = await dbHelper.getAllTransactionTypes(req.charityId);
    if (types.includes(userInput)) {
      console.error(`${userInput} already exists.`);
      log(loggedInName + `: ${userInput} already exists in transaction types`, req.charityId)
      req.flash('error', 'Transaction type already exists.');
      return res.redirect("/addnewtransactiontype")
    } else {
      await dbHelper.insertTransactionType(userInput, req.charityId);
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

app.get("/addnewdonationtype", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const types = await dbHelper.getAllDonationTypes(req.charityId);
    res.render("addnewdonationtype", { loggedInName, types });
  } catch (error) {
    console.error('Error rendering addnewdonationtype page:', error);
    log(loggedInName + ': Error rendering addnewdonationtype page:', error)
    return res.redirect("/admin")
  }});

app.post("/addnewdonationtype", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
const userInput = req.body.new_donation_type;
const loggedInName = req.session.name;
try {
  const types = await dbHelper.getAllDonationTypes(req.charityId);
  if (types.includes(userInput)) {
    console.error(`${userInput} already exists.`);
    req.flash('error', 'Donation type already exists.');
    log(loggedInName + `: ${userInput} donation type already exists`, req.charityId)
    return res.redirect("/addnewdonationtype")
  } else {
    await dbHelper.insertDonationType(userInput, req.charityId);
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

  app.get("/send-update-request/:id", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
    const loggedInName = req.session.name;
    const id = req.params.id;
    try {
      const row = await dbHelper.getMemberWithId(id, req.charityId);
      if (!row) return res.status(404).redirect("/claimants/1");
      if (!row.email) {
        req.flash('error', 'Email is blank or null. Cannot send update email.');
        log(loggedInName + ": Email is blank or null. Cannot send update email for: " + row.first_name + " " + row.surname);
        return res.redirect("/edit/" + id);
      }
      if (row.do_not_email) {
        req.flash('error', 'This member is marked "do not email". Update the member to opt them in first.');
        return res.redirect("/edit/" + id);
      }
      if (isLikelyPlaceholderEmail(row.email)) {
        req.flash('error', 'Email looks like a placeholder (' + row.email + '). Update it to a real address before sending.');
        log(loggedInName + ": Skipped update email — placeholder address for " + row.first_name + " " + row.surname + " (" + row.email + ")");
        return res.redirect("/edit/" + id);
      }
      try {
        // Create a single-use, 14-day token
        const token     = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO member_update_tokens (member_id, charity_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
          [id, req.charityId, token, expiresAt]
        );
        const charity = await dbHelper.getCharityById(req.charityId);
        await emailMemberForUpdate(row, charity?.name, token);
        console.log('Update details link sent via email for: ' + row.first_name + " " + row.surname);
        log(loggedInName + ': Update details link sent via email for: ' + row.first_name + " " + row.surname);
        req.flash('success', 'Email sent successfully.');
        res.redirect("/edit/" + id);
      } catch (error) {
        console.error("Error sending update email", error);
        req.flash('error', 'Error sending email to member, try again!.');
        log(loggedInName + ": Error sending update email - " + error);
        res.redirect("/edit/" + id);
      }
    } catch (error) {
      console.error(error.message);
      log(loggedInName + ": Error retreiving member with ID: " + id + " Error: " + error);
      return res.redirect("/claimants/:page");
    }
  });

// ── Public self-service: member updates their own details via emailed token ──
async function consumeUpdateToken(token, client) {
  const q = client || pool;
  const result = await q.query(
    `SELECT t.*, m.first_name, m.surname, m.title, m.email, m.phone_number,
            m.house_number, m.address_line_1, m.address_line_2, m.city, m.postcode
     FROM member_update_tokens t
     INNER JOIN members m ON m.id = t.member_id
     WHERE t.token = $1`,
    [token]
  );
  if (result.rows.length === 0) return { error: 'invalid' };
  const row = result.rows[0];
  if (row.used_at) return { error: 'used' };
  if (new Date(row.expires_at) < new Date()) return { error: 'expired' };
  return { token: row };
}

app.get("/update-details/:token", async (req, res) => {
  try {
    const { token, error } = await consumeUpdateToken(req.params.token);
    if (error) return res.render("update-details", { token: null, member: null, reason: error, success: false });
    res.render("update-details", {
      token: req.params.token,
      member: {
        title: token.title, first_name: token.first_name, surname: token.surname,
        email: token.email, phone_number: token.phone_number,
        house_number: token.house_number, address_line_1: token.address_line_1,
        address_line_2: token.address_line_2, city: token.city, postcode: token.postcode,
      },
      reason: null,
      success: false,
    });
  } catch (err) {
    console.error('Update-details GET error:', err.message);
    res.status(500).render("update-details", { token: null, member: null, reason: 'error', success: false });
  }
});

app.post("/update-details/:token", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { token, error } = await consumeUpdateToken(req.params.token, client);
    if (error) {
      await client.query('ROLLBACK');
      return res.render("update-details", { token: null, member: null, reason: error, success: false });
    }

    const b = req.body;
    await client.query(
      `UPDATE members
       SET title=$1, first_name=$2, surname=$3, email=$4, phone_number=$5,
           house_number=$6, address_line_1=$7, address_line_2=$8, city=$9, postcode=$10
       WHERE id=$11 AND charity_id=$12`,
      [
        b.title || null, b.first_name || null, b.surname || null,
        b.email || null, b.phone_number || null,
        b.house_number || null, b.address_line_1 || null, b.address_line_2 || null,
        b.city || null, formatPostcode(b.postcode) || null,
        token.member_id, token.charity_id,
      ]
    );
    await client.query(
      `UPDATE member_update_tokens SET used_at = NOW() WHERE id = $1`,
      [token.id]
    );
    await client.query('COMMIT');
    log(`Member ${token.member_id} updated their own details via token`, token.charity_id);
    res.render("update-details", { token: null, member: null, reason: null, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update-details POST error:', err.message);
    res.status(500).render("update-details", { token: req.params.token, member: req.body, reason: 'error', success: false });
  } finally {
    client.release();
  }
});

app.get("/update-users", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const users = await dbHelper.getAllUsers(req.charityId);
    res.render("update-users", { loggedInName, users });
  } catch (error) {
    console.error('Error rendering update-users page:', error);
    log(loggedInName + ': Error rendering update-users page:' + error)
    return res.redirect("/admin")
  }});

app.post("/update-users", requireLogin, injectCharityId, checkUserRole, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  console.log(req.body.approval)
  try {
    const user = await dbHelper.getUserById(req.body.id, req.charityId);
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
    await dbHelper.updateUser(req, req.charityId);
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

  app.get("/software-logs/:page", requireLogin, checkPlatformAdmin, async (req, res) => {
    const rowsPerPage = 50;
    let currentPage = parseInt(req.params.page) || 1;
    if (currentPage < 1) currentPage = 1;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const loggedInName = req.session.name;
    const filters = {
      level:  req.query.level  || 'all',
      user:   req.query.user   || '',
      date:   req.query.date   || '',
      search: req.query.search || '',
    };
    try {
        const [logging, totalRows] = await Promise.all([
          dbHelper.getLogsPaginated(startIndex, rowsPerPage, req.charityId, filters),
          dbHelper.getLogsCount(req.charityId, filters),
        ]);
        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        res.render("software-logs", { loggedInName, logging, currentPage, totalPages, filters, totalRows });
    } catch (error) {
        console.error('Error rendering software-logs page:', error);
        log(loggedInName + ': Error rendering software-logs page - ' + error.message);
        return res.redirect("/admin");
    }
});

// ── API: donor search (used by Add Donation modal) ─────────────────
app.get('/api/members/search', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const like = `%${q}%`;
    const result = await pool.query(
      `SELECT id, first_name, surname, banking_name, spouse_name
       FROM members
       WHERE is_active = 1
         AND charity_id = $1
         AND (first_name ILIKE $2
              OR surname ILIKE $3
              OR (first_name || ' ' || surname) ILIKE $4
              OR spouse_name ILIKE $5
              OR banking_name ILIKE $6)
       ORDER BY first_name ASC
       LIMIT 15`,
      [req.charityId, like, like, like, like, like]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Member search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── API: add donation from modal (JSON) ────────────────────────────
app.post('/api/donations/modal', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  const { member_id, first_name, surname, amount, date, fund, notes, gift_aid_status, transaction_id, confirmed } = req.body;
  try {
    // Check if a donation already exists for this transaction
    if (transaction_id) {
      const existing = await pool.query(
        'SELECT id FROM donations WHERE transaction_id = $1 AND charity_id = $2',
        [transaction_id, req.charityId]
      );
      if (existing.rows.length > 0 && !confirmed) {
        return res.json({ duplicate: true });
      }
    }

    await pool.query(
      'INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes, transaction_id, charity_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [member_id || null, first_name, surname, amount, date, fund, 'Bank', gift_aid_status || 'Unclaimed', notes || null, transaction_id || null, req.charityId]
    );
    log(loggedInName + ': Added donation via modal for ' + first_name + ' ' + surname, req.charityId);
    // Respond immediately — email is fire-and-forget
    res.json({ success: true });
    if (member_id) {
      Promise.resolve().then(async () => {
        const member = await dbHelper.getMemberWithId(member_id, req.charityId);
        const charity = await dbHelper.getCharityById(req.charityId);
        await sendDonationReceivedEmail(member, req.body, charity?.name);
      }).catch(emailErr => console.error('Donation email error:', emailErr.message));
    }
  } catch (err) {
    console.error('Modal donation error:', err.message);
    log(loggedInName + ': Modal donation error: ' + err.message);
    res.status(500).json({ success: false, error: 'Failed to save donation.' });
  }
});

app.get("/select-inactive", requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const result = await pool.query("SELECT * FROM members WHERE charity_id = $1 ORDER BY first_name ASC", [req.charityId]);
    res.render("select-inactive", { loggedInName, row: result.rows });
  } catch (err) {
    console.error("Error fetching donors:", err);
    return res.status(500).send("Database error.");
  }
});


app.post('/deactivate-donors', requireLogin, injectCharityId, async (req, res) => {
  const selectedIds = req.body.selectedIds || [];
  const deactivateIds = Array.isArray(selectedIds) ? selectedIds : [selectedIds];

  const client = await pool.connect();
  try {
    const allResult = await client.query('SELECT id FROM members WHERE charity_id = $1', [req.charityId]);
    const allIds = allResult.rows.map(row => row.id.toString());
    const activateIds = allIds.filter(id => !deactivateIds.includes(id));

    await client.query('BEGIN');

    if (deactivateIds.length > 0) {
      const placeholders = deactivateIds.map((_, i) => `$${i + 2}`).join(',');
      await client.query(`UPDATE members SET is_active = 0 WHERE charity_id = $1 AND id IN (${placeholders})`, [req.charityId, ...deactivateIds]);
    }

    if (activateIds.length > 0) {
      const placeholders = activateIds.map((_, i) => `$${i + 2}`).join(',');
      await client.query(`UPDATE members SET is_active = 1 WHERE charity_id = $1 AND id IN (${placeholders})`, [req.charityId, ...activateIds]);
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

// ── Ladies Fund balance ─────────────────────────────────────
const LADIES_FUND_NAME = 'Ladies Fund';

async function getFundBalance(charityId, fundName) {
  const opening = await pool.query(
    `SELECT opening_date, opening_amount, updated_at, updated_by
       FROM fund_opening_balances
      WHERE charity_id = $1 AND fund_name = $2`,
    [charityId, fundName]
  );

  const openingDate   = opening.rows[0]?.opening_date || null;
  const openingAmount = opening.rows[0] ? Number(opening.rows[0].opening_amount) : 0;

  const movements = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN paid_in  ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN paid_in::numeric  ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN paid_out ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN paid_out::numeric ELSE 0 END), 0) AS expense
     FROM transactions
     WHERE charity_id = $1
       AND (LOWER(TRIM(transaction_type)) = LOWER(TRIM($2))
            OR LOWER(TRIM(type))             = LOWER(TRIM($2)))
       AND ($3::date IS NULL OR date >= $3::date)`,
    [charityId, fundName, openingDate]
  );

  const income  = Number(movements.rows[0].income);
  const expense = Number(movements.rows[0].expense);
  const balance = openingAmount + income - expense;

  return {
    fundName,
    hasOpening: !!opening.rows[0],
    openingDate,
    openingAmount,
    income,
    expense,
    balance,
    updatedAt: opening.rows[0]?.updated_at || null,
    updatedBy: opening.rows[0]?.updated_by || null
  };
}

app.get('/api/fund-balance/ladies', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
  try {
    const data = await getFundBalance(req.charityId, LADIES_FUND_NAME);
    res.json(data);
  } catch (err) {
    console.error('Fund balance error:', err);
    res.status(500).json({ error: 'Could not load fund balance.' });
  }
});

app.post('/api/fund-balance/ladies', requireLogin, injectCharityId, checkApprovedUser, checkAdmin, async (req, res) => {
  const { opening_date, opening_amount } = req.body || {};
  const amt = Number(opening_amount);
  if (!opening_date || !/^\d{4}-\d{2}-\d{2}$/.test(opening_date)) {
    return res.status(400).json({ error: 'Please provide a valid opening date.' });
  }
  if (!Number.isFinite(amt)) {
    return res.status(400).json({ error: 'Please provide a valid opening amount.' });
  }
  try {
    await pool.query(
      `INSERT INTO fund_opening_balances (charity_id, fund_name, opening_date, opening_amount, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (charity_id, fund_name)
       DO UPDATE SET opening_date = EXCLUDED.opening_date,
                     opening_amount = EXCLUDED.opening_amount,
                     updated_at = NOW(),
                     updated_by = EXCLUDED.updated_by`,
      [req.charityId, LADIES_FUND_NAME, opening_date, amt, req.session.name || null]
    );
    log((req.session.name || '?') + ': set ' + LADIES_FUND_NAME + ' opening balance to £' + amt.toFixed(2) + ' as of ' + opening_date);
    const data = await getFundBalance(req.charityId, LADIES_FUND_NAME);
    res.json(data);
  } catch (err) {
    console.error('Save opening balance error:', err);
    res.status(500).json({ error: 'Could not save opening balance.' });
  }
});

app.get('/dashboard', requireLogin, injectCharityId, checkApprovedUser, async (req, res) => {
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
      recentTransactions, recentDonations, topDonors,
      ladiesFund
    ] = await Promise.all([
      dbHelper.getAllTransactionsForYear(currentYear, req.charityId),
      dbHelper.getAllDonationsForYear(currentYear, req.charityId),
      dbHelper.getMonthlyTotals(currentYM, req.charityId),
      dbHelper.getMonthlyTotals(prevYM, req.charityId),
      dbHelper.getYTDDonationTotal(currentYear, req.charityId),
      dbHelper.getMonthlyDonationCount(currentYM, req.charityId),
      dbHelper.getMembersCount(req.charityId),
      dbHelper.getRecentTransactions(5, req.charityId),
      dbHelper.getRecentDonations(5, req.charityId),
      dbHelper.getTopDonors(currentYear, 5, req.charityId),
      getFundBalance(req.charityId, LADIES_FUND_NAME)
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
      ladiesFund,
      isAdmin: req.session.role === 'admin' || req.session.role === 'super admin',
      barChartData: JSON.stringify(monthlyData),
      pieChartData: JSON.stringify(fundBreakdown)
    });
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    res.status(500).send('Server error');
  }
});

// Default response for any other request
app.use(function(req, res){
    res.status(404);
    res.redirect('/claimants/:page')
});