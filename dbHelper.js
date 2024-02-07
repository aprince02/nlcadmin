const db = require('./database.js');

async function getAllTransactionTypes() {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM transaction_types';
    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(row => row.type));
      }
    });
  });
}

async function insertTransactionType(type) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO transaction_types (type) VALUES (?)';
      db.run(sql, [type], function (err) {
        if (err) {
          reject(err);
        } else {
          console.log(`Inserted new transaction type: ${type}, ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      });
    });
  }

  async function getAllDonationTypes() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM donation_types';
      db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.type));
        }
      });
    });
  }
  
  async function insertDonationType(type) {
      return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO donation_types (type) VALUES (?)';
        db.run(sql, [type], function (err) {
          if (err) {
            reject(err);
          } else {
            console.log(`Inserted new donation type: ${type}, ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        });
      });
    }

    async function getAllMembers() {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM members ORDER BY first_name ASC';
        db.all(sql, function (err, rows) {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    }

    async function getMemberWithId(id) {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM members WHERE id = ?';
        db.get(sql, [id], function (err, row) {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      })};


module.exports = {
  getAllTransactionTypes,
  insertTransactionType,
  getAllDonationTypes,
  insertDonationType,
  getAllMembers,
  getMemberWithId
};
