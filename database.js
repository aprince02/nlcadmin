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
            banking_name text
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
                // Table already created
                console.log('donation_types table already exists')
            }else{
                // Table just created
                console.log('donation_types table created')
            }
        });
        
    }
});

module.exports = db