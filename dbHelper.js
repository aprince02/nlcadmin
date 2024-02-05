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

module.exports = {
  getAllTransactionTypes,
  insertTransactionType,
};
