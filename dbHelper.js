const pool = require('./database.js');

async function getAllTransactionTypes() {
  const result = await pool.query('SELECT * FROM transaction_types');
  return result.rows.map(row => row.type);
}

async function insertTransactionType(type) {
  const result = await pool.query(
    'INSERT INTO transaction_types (type) VALUES ($1) RETURNING id',
    [type]
  );
  const id = result.rows[0].id;
  console.log(`Inserted new transaction type: ${type}, ID: ${id}`);
  return id;
}

async function getAllDonationTypes() {
  const result = await pool.query('SELECT * FROM donation_types');
  return result.rows.map(row => row.type);
}

async function insertDonationType(type) {
  const result = await pool.query(
    'INSERT INTO donation_types (type) VALUES ($1) RETURNING id',
    [type]
  );
  const id = result.rows[0].id;
  console.log(`Inserted new donation type: ${type}, ID: ${id}`);
  return id;
}

async function getAllMembers() {
  const result = await pool.query('SELECT * FROM members ORDER BY first_name ASC');
  return result.rows;
}

async function getAllActiveMembers() {
  const result = await pool.query(`
    SELECT * FROM members
    WHERE is_active != 0 OR is_active IS NULL
    ORDER BY first_name ASC
  `);
  return result.rows;
}

async function getMemberWithId(id) {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
  return result.rows[0];
}

async function addNewMember(req) {
  const member = [
    req.body.first_name, req.body.surname, req.body.sex, req.body.email,
    req.body.phone_number, req.body.address_line_1, req.body.address_line_2,
    req.body.city, req.body.postcode, req.body.date_of_birth, req.body.baptised,
    req.body.baptised_date, req.body.holy_spirit, req.body.native_church,
    req.body.children_details, req.body.emergency_contact_1,
    req.body.emergency_contact_1_name, req.body.emergency_contact_2,
    req.body.emergency_contact_2_name, req.body.occupation_studies,
    req.body.title, req.body.house_number,
  ];
  const result = await pool.query(
    `INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1,
      address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit,
      native_church, children_details, emergency_contact_1, emergency_contact_1_name,
      emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    member
  );
  const id = result.rows[0].id;
  console.log(`Inserted new member, ID: ${id}`);
  return id;
}

async function getDonationWithId(id) {
  const result = await pool.query(`
    SELECT
      *,
      TO_CHAR(date, 'YYYY-MM-DD') AS date_input
    FROM donations
    WHERE id = $1
  `, [id]);

  return result.rows[0];
}

async function getAllTransactionsForYear(year) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [`${year}-01-01`, `${year}-12-31`]
  );
  return result.rows;
}

async function getAllTransactionsForPeriod(startDate, endDate) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  return result.rows;
}

async function getAllTransactionsWithOnly(startDate, endDate, exportOnly) {
  let sql = 'SELECT * FROM transactions WHERE date >= $1 AND date <= $2';
  let params = [startDate, endDate];

  if (exportOnly === 'allPaidIn') {
    sql += ' AND CAST(paid_in AS FLOAT) > 0';
  } else if (exportOnly === 'allPaidOut') {
    sql += ' AND CAST(paid_out AS FLOAT) > 0';
  } else if (exportOnly === 'allPaidOutOver£2000') {
    sql += ' AND CAST(paid_out AS FLOAT) >= 2000';
  } else if (exportOnly) {
    sql += ' AND type = $3';
    params.push(exportOnly);
  } else {
    console.log('Error: Invalid transaction type requested.');
    throw new Error('Invalid transaction type.');
  }

  sql += ' ORDER BY date ASC';
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
}

async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

async function updateUser(req) {
  const result = await pool.query(
    'UPDATE users SET name = $1, email = $2, role = $3, approval = $4 WHERE id = $5 RETURNING id',
    [req.body.name, req.body.email, req.body.role, req.body.approval, req.body.id]
  );
  return result.rows[0]?.id;
}

async function getAllLogs() {
  const result = await pool.query('SELECT * FROM console_logs ORDER BY id DESC');
  return result.rows;
}

async function getLogsPaginated(startIndex, rowsPerPage) {
  const result = await pool.query(
    'SELECT * FROM console_logs ORDER BY id DESC LIMIT $1 OFFSET $2',
    [rowsPerPage, startIndex]
  );
  return result.rows;
}

async function getLogsCount() {
  const result = await pool.query('SELECT COUNT(*) AS totalrows FROM console_logs');
  return parseInt(result.rows[0].totalrows, 10);
}

async function getMembersPaginated(startIndex, rowsPerPage) {
  const result = await pool.query(
    'SELECT * FROM members WHERE is_active = 1 ORDER BY first_name ASC LIMIT $1 OFFSET $2',
    [rowsPerPage, startIndex]
  );
  return result.rows;
}

async function getMembersCount() {
  const result = await pool.query('SELECT COUNT(*) AS totalrows FROM members WHERE is_active = 1');
  return parseInt(result.rows[0].totalrows, 10);
}

async function searchMembers(query, startIndex, rowsPerPage) {
  const like = `%${query}%`;
  const result = await pool.query(
    `SELECT * FROM members WHERE is_active = 1
     AND (first_name ILIKE $1 OR surname ILIKE $2 OR (first_name || ' ' || surname) ILIKE $3)
     ORDER BY first_name ASC LIMIT $4 OFFSET $5`,
    [like, like, like, rowsPerPage, startIndex]
  );
  return result.rows;
}

async function searchMembersCount(query) {
  const like = `%${query}%`;
  const result = await pool.query(
    `SELECT COUNT(*) AS totalrows FROM members WHERE is_active = 1
     AND (first_name ILIKE $1 OR surname ILIKE $2 OR (first_name || ' ' || surname) ILIKE $3)`,
    [like, like, like]
  );
  return parseInt(result.rows[0].totalrows, 10);
}

async function getMonthlyTransactionAndDonationSums() {
  const result = await pool.query(`
    SELECT TO_CHAR(date::date, 'YYYY-MM') AS month,
           SUM(CASE WHEN paid_in IS NOT NULL THEN paid_in::FLOAT ELSE 0 END) AS total_in,
           SUM(CASE WHEN paid_out IS NOT NULL THEN paid_out::FLOAT ELSE 0 END) AS total_out
    FROM transactions
    GROUP BY month
    ORDER BY month ASC
  `);
  return result.rows;
}

async function getFundDistribution() {
  const result = await pool.query(`
    SELECT fund, SUM(amount::FLOAT) AS total
    FROM donations
    GROUP BY fund
  `);
  return result.rows;
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
    const fund = d.fund || 'Uncategorised';
    const amount = parseFloat(d.amount || 0);
    breakdown[fund] = (breakdown[fund] || 0) + amount;
  });

  return Object.entries(breakdown).map(([fund, total]) => ({
    fund,
    total
  }));
}

async function getAllDonationsForYear(year) {
  const result = await pool.query(
    'SELECT * FROM donations WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [`${year}-01-01`, `${year}-12-31`]
  );
  return result.rows;
}

async function getMonthlyTotals(yearMonth) {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(CAST(paid_in AS FLOAT)), 0) AS "paidIn",
      COALESCE(SUM(CAST(paid_out AS FLOAT)), 0) AS "paidOut"
    FROM transactions
    WHERE TO_CHAR(date::date, 'YYYY-MM') = $1
  `, [yearMonth]);
  const row = result.rows[0];
  return {
    paidIn:  parseFloat(row.paidIn)  || 0,
    paidOut: parseFloat(row.paidOut) || 0,
    net:     (parseFloat(row.paidIn) || 0) - (parseFloat(row.paidOut) || 0),
  };
}

async function getYTDDonationTotal(year) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount::FLOAT), 0) AS total FROM donations WHERE TO_CHAR(date::date, 'YYYY') = $1`,
    [String(year)]
  );
  return parseFloat(result.rows[0].total) || 0;
}

async function getMonthlyDonationCount(yearMonth) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM donations WHERE TO_CHAR(date::date, 'YYYY-MM') = $1`,
    [yearMonth]
  );
  return parseInt(result.rows[0].count, 10) || 0;
}

async function getRecentTransactions(limit) {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY date DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

async function getRecentDonations(limit) {
  const result = await pool.query(
    'SELECT * FROM donations ORDER BY date DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

async function getDistinctYears() {
  const result = await pool.query(
    `SELECT DISTINCT TO_CHAR(date::date, 'YYYY') AS year FROM transactions WHERE date IS NOT NULL ORDER BY year DESC`
  );
  return result.rows.map(r => r.year);
}

async function importBankTransaction({ date, description, transactionType, paidIn, paidOut, sourceRef }) {
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

  const existing = await pool.query(
    'SELECT id, type FROM transactions WHERE notes = $1',
    [sourceRef]
  );
  if (existing.rows[0]) {
    if (inferredType && !existing.rows[0].type) {
      await pool.query('UPDATE transactions SET type = $1 WHERE id = $2', [inferredType, existing.rows[0].id]);
    }
    return false;
  }
  await pool.query(
    `INSERT INTO transactions (date, transaction_type, type, description, paid_in, paid_out, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [date, transactionType, inferredType, description, paidIn || null, paidOut || null, sourceRef]
  );
  return true;
}

async function getTopDonors(year, limit) {
  const result = await pool.query(`
    SELECT first_name, surname, SUM(amount::FLOAT) AS total
    FROM donations
    WHERE TO_CHAR(date::date, 'YYYY') = $1
    GROUP BY member_id, first_name, surname
    ORDER BY total DESC
    LIMIT $2
  `, [String(year), limit]);
  return result.rows;
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
