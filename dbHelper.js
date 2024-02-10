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
          }});
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

      async function addNewMember(req) {
        return new Promise((resolve, reject) => {
          const member = [req.body.first_name, req.body.surname, req.body.sex, req.body.email, req.body.phone_number, req.body.address_line_1, req.body.address_line_2, req.body.city, req.body.postcode, req.body.date_of_birth, req.body.baptised, req.body.baptised_date, req.body.holy_spirit, req.body.native_church, req.body.children_details, req.body.emergency_contact_1, req.body.emergency_contact_1_name, req.body.emergency_contact_2, req.body.emergency_contact_2_name, req.body.occupation_studies, req.body.title, req.body.house_number,];
          const sql = 'INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name, emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
          db.run(sql, member, function (err) {
            if (err) {
              reject(err);
            } else {
              console.log(`Inserted new member, ID: ${this.lastID}`);
              resolve(this.lastID);
            }});
        });
      }

module.exports = {
  getAllTransactionTypes,
  insertTransactionType,
  getAllDonationTypes,
  insertDonationType,
  getAllMembers,
  getMemberWithId,
  addNewMember
};