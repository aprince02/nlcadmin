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

      async function getDonationWithId(id) {
        return new Promise((resolve, reject) => {
          const sql = 'SELECT * FROM donations WHERE id = ?';
          db.get(sql, [id], function (err, row) {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          });
        })};

async function getAllTransactionsForYear(year) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date ASC";
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getAllTransactionsForPeriod(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date ASC";
    db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
async function getAllTransactionsWithOnly(startDate, endDate, exportOnly) {
  if (exportOnly == 'allPaidIn'){
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? AND CAST(paid_in AS REAL) > 0 ORDER BY date ASC";
      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }});
    });
  } else if (exportOnly == 'allPaidOut') {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? AND CAST(paid_out AS REAL) > 0 ORDER BY date ASC";
      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }});
    });
  } else if (exportOnly == 'allPaidOutOver£2000') {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? AND CAST(paid_out AS REAL) >= 2000 ORDER BY date ASC";
      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }});
    });
  } else if (exportOnly == 'support&charity') {
    return new Promise((resolve, reject) => {
      const typeName = 'Support & Charity'
      const sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ? AND type = ? ORDER BY date ASC";
      db.all(sql, [startDate, endDate, typeName], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }});
    });
  } else {
    console.log('something went wrong with retrieving transactions: Incorrect type may have been requested')
  }};

async function getAllUsers() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM user";
    db.all(sql,(err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }});
  });
}

async function getUserById(id) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM user WHERE (id = ?)";
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }});
  });
}

async function updateUser(req) {
return new Promise((resolve, reject) => {
  const user = [req.body.name, req.body.email, req.body.role, req.body.id];
  const sql = 'UPDATE user set name = ?, email = ?, role = ? WHERE (id = ?)';
  db.run(sql, user, function (err) {
    if (err) {
      reject(err);
    } else {
      resolve(this.lastID);
    }});
  });
}

async function getAllLogs() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM console_logs ORDER BY ID DESC";
    db.all(sql,(err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }});
  });
}

async function getLogsPaginated(startIndex, rowsPerPage) {
  return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM console_logs ORDER BY ID DESC LIMIT ? OFFSET ?";
      db.all(sql, [rowsPerPage, startIndex], (err, rows) => {
          if (err) {
              reject(err);
          } else {
              resolve(rows);
          }
      });
  });
}

async function getLogsCount() {
  return new Promise((resolve, reject) => {
      const sql = "SELECT COUNT(*) AS totalRows FROM console_logs";
      db.get(sql, (err, row) => {
          if (err) {
              reject(err);
          } else {
              resolve(row.totalRows);
          }
      });
  });
}

async function getMembersPaginated(startIndex, rowsPerPage) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM members ORDER BY first_name ASC LIMIT ? OFFSET ?";
    db.all(sql, [rowsPerPage, startIndex], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getMembersCount() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT COUNT(*) AS totalRows FROM members";
    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.totalRows);
      }
    });
  });
}

module.exports = {
  getAllTransactionTypes,
  insertTransactionType,
  getAllDonationTypes,
  insertDonationType,
  getAllMembers,
  getMemberWithId,
  addNewMember,
  getDonationWithId,
  getAllTransactionsForYear,
  getAllTransactionsForPeriod,
  getAllTransactionsWithOnly,
  getAllUsers,
  getUserById,
  updateUser,
  getAllLogs,
  getLogsPaginated,
  getLogsCount,
  getMembersCount,
  getMembersPaginated
};