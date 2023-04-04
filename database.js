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
        db.run(`CREATE TABLE claimant (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name text,
            surname text,
            date_of_birth date,
            claim_status text,
            sort_code INTEGER,
            account_number INTEGER
            )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('claimant table already created')
            }else{
                // Table just created, creating some rows
                var insert_claimants = 'INSERT INTO claimant (first_name, surname, date_of_birth, claim_status, sort_code, account_number) VALUES (?,?,?,?,?,?)'
                db.run(insert_claimants, ["John", "Doe", "2000-01-01", "ACTIVE", "123456", "12345678"])
                db.run(insert_claimants, ["Mary", "Anne", "2000-01-01", "ACTIVE", "123456", "12345678"])
                db.run(insert_claimants, ["Sam", "Smith", "2000-01-01", "EXPIRED", "123456", "12345678"])
            }
        });  
        db.run(`CREATE TABLE payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claimant_id INTEGER,
            amount text,
            date date,
            payment_status text
        )`,
        (err) => {
            if (err) {
                // Table already created
                console.log('payments table already created')
            }else{
                // Table just created, creating some rows
                var insert_claimants = 'INSERT INTO payments (claimant_id, amount, date, payment_status) VALUES (?,?,?,?)'
                db.run(insert_claimants, ["1", "12.79", "2022-01-01", "SUCCESS"])
                db.run(insert_claimants, ["2", "10.40", "2022-01-01", "SUCCESS"])
                db.run(insert_claimants, ["3", "102.30", "2023-01-01", "SUCCESS"])
            }
        }
        
        )
    }
});

module.exports = db