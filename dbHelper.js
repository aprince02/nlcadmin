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

    async function getAllActiveMembers() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM members
      WHERE is_active != 0 OR is_active IS NULL
      ORDER BY first_name ASC
    `;
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
  return new Promise((resolve, reject) => {
    let sql = "SELECT * FROM transactions WHERE date >= ? AND date <= ?";
    let params = [startDate, endDate];

    if (exportOnly === "allPaidIn") {
      sql += " AND CAST(paid_in AS REAL) > 0";
    } else if (exportOnly === "allPaidOut") {
      sql += " AND CAST(paid_out AS REAL) > 0";
    } else if (exportOnly === "allPaidOutOver£2000") {
      sql += " AND CAST(paid_out AS REAL) >= 2000";
    } else if (exportOnly) {
      sql += " AND type = ?";
      params.push(exportOnly); // Dynamically set any type
    } else {
      console.log("Error: Invalid transaction type requested.");
      return reject(new Error("Invalid transaction type."));
    }

    sql += " ORDER BY date ASC";

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}


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
  const user = [req.body.name, req.body.email, req.body.role, req.body.approval, req.body.id];
  const sql = 'UPDATE user set name = ?, email = ?, role = ?, approval = ? WHERE (id = ?)';
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
    const sql = "SELECT * FROM members WHERE is_active = 1 ORDER BY first_name ASC LIMIT ? OFFSET ?";
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
    const sql = "SELECT COUNT(*) AS totalRows FROM members WHERE is_active = 1";
    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.totalRows);
      }
    });
  });
}

async function searchMembers(query, startIndex, rowsPerPage) {
  return new Promise((resolve, reject) => {
    const like = `%${query}%`;
    const sql = `SELECT * FROM members WHERE is_active = 1
                 AND (first_name LIKE ? OR surname LIKE ? OR (first_name || ' ' || surname) LIKE ?)
                 ORDER BY first_name ASC LIMIT ? OFFSET ?`;
    db.all(sql, [like, like, like, rowsPerPage, startIndex], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function searchMembersCount(query) {
  return new Promise((resolve, reject) => {
    const like = `%${query}%`;
    const sql = `SELECT COUNT(*) AS totalRows FROM members WHERE is_active = 1
                 AND (first_name LIKE ? OR surname LIKE ? OR (first_name || ' ' || surname) LIKE ?)`;
    db.get(sql, [like, like, like], (err, row) => {
      if (err) reject(err);
      else resolve(row.totalRows);
    });
  });
}

async function getMonthlyTransactionAndDonationSums() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT strftime('%Y-%m', date) AS month,
             SUM(CASE WHEN paid_in IS NOT NULL THEN paid_in ELSE 0 END) AS total_in,
             SUM(CASE WHEN paid_out IS NOT NULL THEN paid_out ELSE 0 END) AS total_out
      FROM transactions
      GROUP BY month
      ORDER BY month ASC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getFundDistribution() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT fund, SUM(amount) AS total
      FROM donations
      GROUP BY fund
    `;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function generateMonthlyData(transactions) {
  const data = {};

  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!data[monthKey]) {
      data[monthKey] = { paidIn: 0, paidOut: 0 };
    }

    data[monthKey].paidIn += parseFloat(tx.paid_in || 0);
    data[monthKey].paidOut += parseFloat(tx.paid_out || 0);
  });

  return Object.entries(data).sort().map(([month, values]) => ({
    month,
    ...values
  }));
}

function generateFundBreakdown(donations) {
  const breakdown = {};

  donations.forEach(d => {
    const fund = d.fund || "Uncategorised";
    const amount = parseFloat(d.amount || 0);
    breakdown[fund] = (breakdown[fund] || 0) + amount;
  });

  return Object.entries(breakdown).map(([fund, total]) => ({
    fund,
    total
  }));
}

async function getAllDonationsForYear(year) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM donations WHERE date >= ? AND date <= ? ORDER BY date ASC";
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

async function getMonthlyTotals(yearMonth) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COALESCE(SUM(CAST(paid_in  AS REAL)), 0) AS paidIn,
        COALESCE(SUM(CAST(paid_out AS REAL)), 0) AS paidOut
      FROM transactions
      WHERE strftime('%Y-%m', date) = ?
    `;
    db.get(sql, [yearMonth], (err, row) => {
      if (err) reject(err);
      else resolve({
        paidIn:  row.paidIn  || 0,
        paidOut: row.paidOut || 0,
        net:     (row.paidIn || 0) - (row.paidOut || 0)
      });
    });
  });
}

async function getYTDDonationTotal(year) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT COALESCE(SUM(amount), 0) AS total FROM donations WHERE strftime('%Y', date) = ?`;
    db.get(sql, [String(year)], (err, row) => {
      if (err) reject(err);
      else resolve(row.total || 0);
    });
  });
}

async function getMonthlyDonationCount(yearMonth) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT COUNT(*) AS count FROM donations WHERE strftime('%Y-%m', date) = ?`;
    db.get(sql, [yearMonth], (err, row) => {
      if (err) reject(err);
      else resolve(row.count || 0);
    });
  });
}

async function getRecentTransactions(limit) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM transactions ORDER BY date DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getRecentDonations(limit) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM donations ORDER BY date DESC LIMIT ?`;
    db.all(sql, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getDistinctYears() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT DISTINCT strftime('%Y', date) AS year FROM transactions WHERE date IS NOT NULL ORDER BY year DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.year));
    });
  });
}

async function importBankTransaction({ date, description, transactionType, paidIn, paidOut, sourceRef }) {
  // Infer type from description (same logic as CSV import)
  let inferredType = null;
  const desc = (description || '').toLowerCase();
  if (desc.includes('offering')) {
    inferredType = 'Offering';
  } else if (desc.includes('zoom')) {
    inferredType = 'Audio/Visual/Licenses';
  } else if (desc.includes('food')) {
    inferredType = 'Food';
  } else if (desc.includes('hmrc charities')) {
    inferredType = 'Gift Aid Claim';
  } else if (desc.includes('snacks')) {
    inferredType = 'Food';
  } else if (desc.includes('total charges')) {
    inferredType = 'Bank Charges';
  }

  return new Promise((resolve, reject) => {
    db.get(`SELECT id, type FROM transactions WHERE notes = ?`, [sourceRef], (err, existing) => {
      if (err) return reject(err);
      if (existing) {
        // Update type if it was not previously inferred
        if (inferredType && !existing.type) {
          db.run(`UPDATE transactions SET type = ? WHERE id = ?`, [inferredType, existing.id]);
        }
        return resolve(false);
      }
      db.run(
        `INSERT INTO transactions (date, transaction_type, type, description, paid_in, paid_out, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, transactionType, inferredType, description, paidIn || null, paidOut || null, sourceRef],
        function(err) {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  });
}

async function getTopDonors(year, limit) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT first_name, surname, SUM(amount) AS total
      FROM donations
      WHERE strftime('%Y', date) = ?
      GROUP BY member_id
      ORDER BY total DESC
      LIMIT ?
    `;
    db.all(sql, [String(year), limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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
  getMembersPaginated,
  searchMembers,
  searchMembersCount,
  getAllActiveMembers,
  getMonthlyTransactionAndDonationSums,
  getFundDistribution,
  generateFundBreakdown,
  generateMonthlyData,
  getAllDonationsForYear,
  getMonthlyTotals,
  getYTDDonationTotal,
  getMonthlyDonationCount,
  getRecentTransactions,
  getRecentDonations,
  getTopDonors,
  getDistinctYears,
  importBankTransaction,
};