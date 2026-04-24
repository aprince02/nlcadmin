# ProBooks Accounting

Multi-tenant accounting and Gift Aid claiming software for UK charities and churches, currently used in production by NewLife Church Sunderland and rolled out to additional charities.

The app is still under active development. Please report bugs or feature requests via issue tracker.

## Features

### Core accounting
- **Transactions** — full ledger with import from bank CSVs, manual entry, categorisation by type, and edit/save in the yearly transactions grid
- **Donations** — per-donor donation records, fund-level reporting, and automatic donation-received email receipts with details table and scripture
- **Members / Claimants** — add, edit, and deactivate members. Admin-only full edit via `/edit-member/:id`; members can update their own name, contact, and address via a token-protected public form
- **Charity settings** — logo, contact details, treasurer name, custom transaction and donation types per charity

### Gift Aid claiming (HMRC-ready)
- **Summary modal** — shows count of unclaimed donations, donation total, and receivable from HMRC (25%)
- **Review modal** — displays each unclaimed donation in the exact format HMRC requires (Title, First Name, Last Name, House No., Postcode, Amount, Date DD/MM/YY)
- **Inline fixes** — rows missing required data are highlighted, with editable input fields and Save buttons. Saves via `PATCH /api/member/:id` (postcode auto-formatted to HMRC format: `SW1A 1AA`)
- **Safe export** — only complete records are exported and marked as Claimed. Each export creates a `gift_aid_claims` row with the full CSV content archived for audit and re-download
- **Claim history** — "Gift Aid Claim History" modal lists every past claim with date, user, record count, total and receivable; each row offers CSV re-download

### PDF exports
- **Statement of Donations** — per-donor, customisable date range, download or email to any address
- **Donations export** — all donations, by fund, over a date range
- **Transaction totals** — by type, with optional CSV attachment when emailed
- **Statement of Transactions** — grouped by type
- All PDFs are generated in-memory (`jspdf` + `jspdf-autotable`), compressed, and either streamed as downloads or sent as email attachments — no temp files

### Email
- Branded HTML template shared across all outgoing emails, with plain-text fallback
- Supports: Gift Aid exports, statements, invites, member self-update, donation receipts, password / OTP flows, admin notifications
- SMTP config via `.env` — credentials never in source

### Authentication & multi-tenancy
- Session-based login, bcrypt password hashing
- Role-based access: `admin`, `super admin`, plain user
- Approval workflow for new users
- Tenant scoping via `req.charityId` injected from session — all queries filter by `charity_id`
- Invite flow (`/charity/invite`) with expiring single-use tokens for admins to onboard users to their charity

### Bank integration
- **TrueLayer Open Banking** — OAuth consent flow, scheduled daily sync of transactions
- Encrypted access/refresh tokens (AES-256 via `TOKEN_ENCRYPTION_KEY`)
- Import from manually-supplied bank CSV as a fallback

## Tech stack

- **Runtime** — Node.js + Express
- **Database** — PostgreSQL (Supabase in production), schema auto-initialised on boot
- **Views** — EJS server-side templates, Bootstrap 5 styling
- **PDF** — jspdf + jspdf-autotable
- **Email** — nodemailer via Zoho SMTP
- **Bank** — TrueLayer Open Banking API

## Project structure

```
/
├── server.js               # express app, most routes
├── database.js             # pool + CREATE TABLE IF NOT EXISTS for all schemas
├── dbHelper.js             # common SQL helpers (members, donations, charities)
├── emailer.js              # branded email template + all sendX functions
├── pdf-generator.js        # jsPDF PDF builders (donor, donations, transactions, totals)
├── csvGenerator.js         # Gift Aid HMRC CSV builder + date/postcode formatting
├── utils.js                # log, readCSVAndProcess, auth middleware, formatPostcode
├── routes/
│   ├── bank.js             # TrueLayer OAuth + transaction sync
│   ├── invites.js          # invite accept / onboarding
│   └── superadmin.js       # super admin routes (create charities, invite admins)
├── truelayer/
│   └── sync.js             # scheduled bank sync
├── views/                  # EJS templates
│   ├── _loggedInHeader.ejs
│   ├── _publicHeader.ejs
│   ├── _claimantEditor.ejs # shared member form fields
│   ├── admin.ejs           # admin console (exports, gift aid, invites)
│   ├── claimants.ejs       # member list + inline edit modal
│   ├── edit-member.ejs
│   ├── update-details.ejs  # public token-protected member self-update
│   ├── donations.ejs
│   ├── yearly-transactions.ejs
│   └── ...
├── public/uploads/logos/   # uploaded charity logos (not in repo)
├── css/                    # static assets
└── .env                    # secrets (NOT committed)
```

## License

ISC
