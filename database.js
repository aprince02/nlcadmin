var sqlite3 = require('sqlite3').verbose()
const DBSOURCE = "db.sqlite"

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    }else{
        console.log('Connected to the SQLite database.')
        db.run(`CREATE TABLE user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name text, 
            email text UNIQUE, 
            password text, 
            role text,
            security_question text,
            approval text,
            CONSTRAINT email_unique UNIQUE (email)
            )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('user table already exists')
            }else{
                // Table just created
                console.log('user table created')
            }
        }); 
        db.run(`CREATE TABLE members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title text,
            first_name text,
            surname text,
            sex text,
            email text,
            phone_number text,
            house_number INTEGER,
            address_line_1 text,
            address_line_2 text,
            city text, 
            postcode text,
            date_of_birth date,
            baptised text,
            baptised_date date,
            holy_spirit text, 
            native_church text, 
            children_details text,
            emergency_contact_1 INTEGER,
            emergency_contact_1_name text, 
            emergency_contact_2 INTEGER,
            emergency_contact_2_name text,
            occupation_studies text,
            spouse_name text,
            banking_name text,
            is_active INTEGER DEFAULT 1,
            )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('members table already exists')
            }else{
                // Table just created
                console.log('members table created')
            }
        });
        db.run(`CREATE TABLE donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            first_name text,
            surname text,
            amount text,
            date date,
            fund text,
            method text,
            gift_aid_status text,
            notes text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('donations table already exists')
            }else{
                // Table just created
                console.log('donations table created')
            }
        });
        db.run(`CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date date,
            transaction_type text,
            type text,
            description text,
            paid_out text,
            paid_in text,
            balance text,
            notes text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('transactions table already exists')
            }else{
                // Table just created
                console.log('transactions table created')
            }
        })
        db.run(`CREATE TABLE last_update (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp text,
            user text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('last_update table already exists')
            }else{
                // Table just created
                console.log('last_update table created')
            }
        })
        db.run(`CREATE TABLE console_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp text,
            user text,
            log_message text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('logs table already exists')
            }else{
                // Table just created
                console.log('logs table created')
            }
        });
        db.run(`CREATE TABLE transaction_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type text UNIQUE NOT NULL
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('transaction_types table already exists')
            }else{
                // Table just created
                console.log('transaction_types table created')
            }
        });
        db.run(`CREATE TABLE donation_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type text UNIQUE NOT NULL
        )`,
        (err) => {
            if (err) {
                console.log('donation_types table already exists')
            }else{
                console.log('donation_types table created')
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS bank_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT UNIQUE NOT NULL,
            account_name TEXT,
            account_type TEXT,
            account_number TEXT,
            sort_code TEXT,
            currency TEXT DEFAULT 'GBP',
            provider_id TEXT,
            access_token_enc TEXT,
            refresh_token_enc TEXT,
            token_expires_at TEXT,
            consent_expires_at TEXT,
            last_synced_at TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        )`,
        (err) => {
            if (err) console.log('bank_connections table already exists');
            else console.log('bank_connections table created');
        });
        db.run(`CREATE TABLE IF NOT EXISTS bank_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            current REAL,
            available REAL,
            currency TEXT DEFAULT 'GBP',
            recorded_at TEXT DEFAULT (datetime('now'))
        )`,
        (err) => {
            if (err) console.log('bank_balances table already exists');
            else console.log('bank_balances table created');
        });
        db.run(`CREATE TABLE IF NOT EXISTS bank_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            provider_transaction_id TEXT UNIQUE,
            date TEXT,
            description TEXT,
            amount REAL,
            currency TEXT DEFAULT 'GBP',
            transaction_type TEXT,
            merchant_name TEXT,
            category TEXT,
            status TEXT DEFAULT 'posted',
            raw_payload TEXT,
            imported_at TEXT DEFAULT (datetime('now'))
        )`,
        (err) => {
            if (err) console.log('bank_transactions table already exists');
            else console.log('bank_transactions table created');
        });
        db.run(`CREATE TABLE IF NOT EXISTS bank_sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT,
            sync_type TEXT,
            status TEXT,
            records_fetched INTEGER DEFAULT 0,
            records_inserted INTEGER DEFAULT 0,
            error_message TEXT,
            synced_at TEXT DEFAULT (datetime('now'))
        )`,
        (err) => {
            if (err) console.log('bank_sync_log table already exists');
            else console.log('bank_sync_log table created');
        });
        db.run(`CREATE TABLE offering_claim (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER UNIQUE,
            type text,
            date date,
            description text,
            amount text,
            claimed text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('offering_claim table already exists')
            }else{
                // Table just created
                console.log('offering_claim table created')
            }
        });    
    }
});

module.exports = db