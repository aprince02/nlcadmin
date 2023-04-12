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
            CONSTRAINT email_unique UNIQUE (email)
            )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('user table already created')
            }else{
                // Table just created, creating some rows
                var insert_users = 'INSERT INTO user (name, email, password, role) VALUES (?,?,?,?)'
                db.run(insert_users, ["admin","admin@example.com","$2b$10$LShoUAWkUqUFUl.9VbEGEeiqACW3PZgEUPZEDCCL6MXTwuAM8CvrO", "admin"])
                db.run(insert_users, ["user","user@example.com","$2b$10$cwJOkKGK9vrKy8nNbUJzFeRzRUqtgvue//8TE871zuVyLelonlR6.", "user"])
            }
        }); 
        db.run(`CREATE TABLE members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name text,
            surname text,
            sex text,
            email text,
            phone_number text,
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
            occupation_studies text

            )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('members table already created')
            }else{
                // Table just created, creating some rows
                var insert_members = 'INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name, emergency_contact_2, emergency_contact_2_name, occupation_studies) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                db.run(insert_members, ["Test", "TestSurname", "MALE", "test@test.com", "07737188124", "test address 1", "test address 2", "test city", "test postcode", "1999-01-01", "YES", "2022-01-01", "YES", "Native Church Name", "Child 1 2022-01-01, Child 2 2022-01-01", "Name One", "07737188124", "Name Two", "07737188124", "Developer"])
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
                console.log('donations table already created')
            }else{
                // Table just created, creating some rows
                var insert_claimants = 'INSERT INTO donations (member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes) VALUES (?,?,?,?,?,?,?,?,?)'
                db.run(insert_claimants, ["1", 'test', 'testsurname', "12.79", "2022-01-01", "Tithe", "Cash", "Unclaimed", ""])
                db.run(insert_claimants, ["2", 'test', 'testsurname', "10.40", "2022-01-01", "Van Gift", "Cash", "Claimed", "van"])
                db.run(insert_claimants, ["3", 'test', 'testsurname', "102.30", "2023-01-01", "Church Building", "Bank", "Unclaimed", ""])
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
                console.log('transactions table already created')
            }else{
                // Table just created, creating some rows
                var insert_claimants = 'INSERT INTO transactions (date, transaction_type, type, description, paid_out, paid_in, balance, notes) VALUES (?,?,?,?,?,?,?,?)'
                db.run(insert_claimants, ["2023-02-10","BP", "Tithe", "PRINCE MATHEW Tithe", "", "100.00", "31100", "February"])
                db.run(insert_claimants, ["2023-02-01","BP", "Provisions", "PRINCE MATHEW Food Purchase", "50.50", "", "31000", "Sunday Food"])
                db.run(insert_claimants, ["2023-01-01","BP", "Offering", "PRINCE MATHEW Offering", "", "50.50", "30949.50", ""])

            }
        })
    }
});

module.exports = db