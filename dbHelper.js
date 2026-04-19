const pool = require('./database.js');
const { formatPostcode } = require('./utils');

async function getAllTransactionTypes(charityId) {
  const result = await pool.query(
    'SELECT * FROM transaction_types WHERE charity_id = $1 ORDER BY type ASC',
    [charityId]
  );
  return result.rows.map(row => row.type);
}

async function insertTransactionType(type, charityId) {
  const result = await pool.query(
    'INSERT INTO transaction_types (type, charity_id) VALUES ($1, $2) RETURNING id',
    [type, charityId]
  );
  const id = result.rows[0].id;
  console.log(`Inserted new transaction type: ${type}, ID: ${id}`);
  return id;
}

async function getAllDonationTypes(charityId) {
  const result = await pool.query(
    'SELECT * FROM donation_types WHERE charity_id = $1 ORDER BY type ASC',
    [charityId]
  );
  return result.rows.map(row => row.type);
}

async function insertDonationType(type, charityId) {
  const result = await pool.query(
    'INSERT INTO donation_types (type, charity_id) VALUES ($1, $2) RETURNING id',
    [type, charityId]
  );
  const id = result.rows[0].id;
  console.log(`Inserted new donation type: ${type}, ID: ${id}`);
  return id;
}

async function getAllMembers(charityId) {
  const result = await pool.query(
    'SELECT * FROM members WHERE charity_id = $1 ORDER BY first_name ASC',
    [charityId]
  );
  return result.rows;
}

async function getAllActiveMembers(charityId) {
  const result = await pool.query(`
    SELECT * FROM members
    WHERE charity_id = $1
      AND (is_active != 0 OR is_active IS NULL)
    ORDER BY first_name ASC
  `, [charityId]);
  return result.rows;
}

async function getMemberWithId(id, charityId) {
  const result = await pool.query(
    'SELECT * FROM members WHERE id = $1 AND charity_id = $2',
    [id, charityId]
  );
  return result.rows[0];
}

async function addNewMember(req, charityId) {
  // Helpers: blank form fields arrive as "" — convert to null for typed columns
  const str  = v => (v === '' || v == null) ? null : v;
  const date = v => (v === '' || v == null) ? null : v;
  const int  = v => (v === '' || v == null) ? null : parseInt(v, 10) || null;
  const pc   = v => (v === '' || v == null) ? null : formatPostcode(v);

  const member = [
    str(req.body.first_name), str(req.body.surname), str(req.body.sex), str(req.body.email),
    str(req.body.phone_number), str(req.body.address_line_1), str(req.body.address_line_2),
    str(req.body.city), pc(req.body.postcode), date(req.body.date_of_birth), str(req.body.baptised),
    date(req.body.baptised_date), str(req.body.holy_spirit), str(req.body.native_church),
    str(req.body.children_details), int(req.body.emergency_contact_1),
    str(req.body.emergency_contact_1_name), int(req.body.emergency_contact_2),
    str(req.body.emergency_contact_2_name), str(req.body.occupation_studies),
    str(req.body.title), str(req.body.house_number),
    charityId,
  ];
  const result = await pool.query(
    `INSERT INTO members (first_name, surname, sex, email, phone_number, address_line_1,
      address_line_2, city, postcode, date_of_birth, baptised, baptised_date, holy_spirit,
      native_church, children_details, emergency_contact_1, emergency_contact_1_name,
      emergency_contact_2, emergency_contact_2_name, occupation_studies, title, house_number,
      charity_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING id`,
    member
  );
  const id = result.rows[0].id;
  console.log(`Inserted new member, ID: ${id}`);
  return id;
}

async function getDonationWithId(id, charityId) {
  const result = await pool.query(`
    SELECT
      *,
      TO_CHAR(date, 'YYYY-MM-DD') AS date_input
    FROM donations
    WHERE id = $1 AND charity_id = $2
  `, [id, charityId]);

  return result.rows[0];
}

async function getAllTransactionsForYear(year, charityId) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3 ORDER BY date ASC',
    [`${year}-01-01`, `${year}-12-31`, charityId]
  );
  return result.rows;
}

async function getAllTransactionsForPeriod(startDate, endDate, charityId) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3 ORDER BY date ASC',
    [startDate, endDate, charityId]
  );
  return result.rows;
}

async function getAllTransactionsWithOnly(startDate, endDate, exportOnly, charityId) {
  let sql = 'SELECT * FROM transactions WHERE date >= $1 AND date <= $2 AND charity_id = $3';
  let params = [startDate, endDate, charityId];

  if (exportOnly === 'allPaidIn') {
    sql += " AND NULLIF(paid_in, '')::FLOAT > 0";
  } else if (exportOnly === 'allPaidOut') {
    sql += " AND NULLIF(paid_out, '')::FLOAT > 0";
  } else if (exportOnly === 'allPaidOutOver£2000') {
    sql += " AND NULLIF(paid_out, '')::FLOAT >= 2000";
  } else if (exportOnly) {
    sql += ' AND type = $4';
    params.push(exportOnly);
  } else {
    console.log('Error: Invalid transaction type requested.');
    throw new Error('Invalid transaction type.');
  }

  sql += ' ORDER BY date ASC';
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getAllUsers(charityId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE charity_id = $1',
    [charityId]
  );
  return result.rows;
}

async function getUserById(id, charityId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1 AND charity_id = $2',
    [id, charityId]
  );
  return result.rows[0];
}

async function updateUser(req, charityId) {
  const result = await pool.query(
    'UPDATE users SET name = $1, email = $2, role = $3, approval = $4 WHERE id = $5 AND charity_id = $6 RETURNING id',
    [req.body.name, req.body.email, req.body.role, req.body.approval, req.body.id, charityId]
  );
  return result.rows[0]?.id;
}

async function getAllLogs(charityId) {
  const result = await pool.query(
    'SELECT * FROM console_logs WHERE charity_id = $1 ORDER BY id DESC',
    [charityId]
  );
  return result.rows;
}

async function getLogsPaginated(startIndex, rowsPerPage, charityId, filters = {}) {
  const conditions = ['charity_id = $1'];
  const params = [charityId];
  let i = 2;

  if (filters.level && filters.level !== 'all') {
    conditions.push(`level = $${i++}`);
    params.push(filters.level);
  }
  if (filters.user) {
    conditions.push(`"user" ILIKE $${i++}`);
    params.push(`%${filters.user}%`);
  }
  if (filters.date) {
    conditions.push(`timestamp::date = $${i++}`);
    params.push(filters.date);
  }
  if (filters.search) {
    conditions.push(`log_message ILIKE $${i++}`);
    params.push(`%${filters.search}%`);
  }

  const where = conditions.join(' AND ');
  const result = await pool.query(
    `SELECT * FROM console_logs WHERE ${where} ORDER BY id DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, rowsPerPage, startIndex]
  );
  return result.rows;
}

async function getLogsCount(charityId, filters = {}) {
  const conditions = ['charity_id = $1'];
  const params = [charityId];
  let i = 2;

  if (filters.level && filters.level !== 'all') {
    conditions.push(`level = $${i++}`);
    params.push(filters.level);
  }
  if (filters.user) {
    conditions.push(`"user" ILIKE $${i++}`);
    params.push(`%${filters.user}%`);
  }
  if (filters.date) {
    conditions.push(`timestamp::date = $${i++}`);
    params.push(filters.date);
  }
  if (filters.search) {
    conditions.push(`log_message ILIKE $${i++}`);
    params.push(`%${filters.search}%`);
  }

  const where = conditions.join(' AND ');
  const result = await pool.query(
    `SELECT COUNT(*) AS totalrows FROM console_logs WHERE ${where}`,
    params
  );
  return parseInt(result.rows[0].totalrows, 10);
}

async function getMembersPaginated(startIndex, rowsPerPage, charityId) {
  const result = await pool.query(
    'SELECT * FROM members WHERE is_active = 1 AND charity_id = $1 ORDER BY first_name ASC LIMIT $2 OFFSET $3',
    [charityId, rowsPerPage, startIndex]
  );
  return result.rows;
}

async function getMembersCount(charityId) {
  const result = await pool.query(
    'SELECT COUNT(*) AS totalrows FROM members WHERE is_active = 1 AND charity_id = $1',
    [charityId]
  );
  return parseInt(result.rows[0].totalrows, 10);
}

async function searchMembers(query, startIndex, rowsPerPage, charityId) {
  const like = `%${query}%`;
  const result = await pool.query(
    `SELECT * FROM members WHERE is_active = 1 AND charity_id = $1
     AND (first_name ILIKE $2 OR surname ILIKE $3 OR (first_name || ' ' || surname) ILIKE $4)
     ORDER BY first_name ASC LIMIT $5 OFFSET $6`,
    [charityId, like, like, like, rowsPerPage, startIndex]
  );
  return result.rows;
}

async function searchMembersCount(query, charityId) {
  const like = `%${query}%`;
  const result = await pool.query(
    `SELECT COUNT(*) AS totalrows FROM members WHERE is_active = 1 AND charity_id = $1
     AND (first_name ILIKE $2 OR surname ILIKE $3 OR (first_name || ' ' || surname) ILIKE $4)`,
    [charityId, like, like, like]
  );
  return parseInt(result.rows[0].totalrows, 10);
}

async function getMonthlyTransactionAndDonationSums(charityId) {
  const result = await pool.query(`
    SELECT TO_CHAR(date::date, 'YYYY-MM') AS month,
           SUM(CASE WHEN paid_in IS NOT NULL THEN paid_in::FLOAT ELSE 0 END) AS total_in,
           SUM(CASE WHEN paid_out IS NOT NULL THEN paid_out::FLOAT ELSE 0 END) AS total_out
    FROM transactions
    WHERE charity_id = $1
    GROUP BY month
    ORDER BY month ASC
  `, [charityId]);
  return result.rows;
}

async function getFundDistribution(charityId) {
  const result = await pool.query(`
    SELECT fund, SUM(amount::FLOAT) AS total
    FROM donations
    WHERE charity_id = $1
    GROUP BY fund
  `, [charityId]);
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

async function getAllDonationsForYear(year, charityId) {
  const result = await pool.query(
    'SELECT * FROM donations WHERE date >= $1 AND date <= $2 AND charity_id = $3 ORDER BY date ASC',
    [`${year}-01-01`, `${year}-12-31`, charityId]
  );
  return result.rows;
}

async function getMonthlyTotals(yearMonth, charityId) {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(NULLIF(paid_in, '')::FLOAT), 0) AS "paidIn",
      COALESCE(SUM(NULLIF(paid_out, '')::FLOAT), 0) AS "paidOut"
    FROM transactions
    WHERE TO_CHAR(date::date, 'YYYY-MM') = $1
      AND charity_id = $2
  `, [yearMonth, charityId]);
  const row = result.rows[0];
  return {
    paidIn:  parseFloat(row.paidIn)  || 0,
    paidOut: parseFloat(row.paidOut) || 0,
    net:     (parseFloat(row.paidIn) || 0) - (parseFloat(row.paidOut) || 0),
  };
}

async function getYTDDonationTotal(year, charityId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount::FLOAT), 0) AS total FROM donations
     WHERE TO_CHAR(date::date, 'YYYY') = $1 AND charity_id = $2`,
    [String(year), charityId]
  );
  return parseFloat(result.rows[0].total) || 0;
}

async function getMonthlyDonationCount(yearMonth, charityId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM donations
     WHERE TO_CHAR(date::date, 'YYYY-MM') = $1 AND charity_id = $2`,
    [yearMonth, charityId]
  );
  return parseInt(result.rows[0].count, 10) || 0;
}

async function getRecentTransactions(limit, charityId) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE charity_id = $1 ORDER BY date DESC LIMIT $2',
    [charityId, limit]
  );
  return result.rows;
}

async function getRecentDonations(limit, charityId) {
  const result = await pool.query(
    'SELECT * FROM donations WHERE charity_id = $1 ORDER BY date DESC LIMIT $2',
    [charityId, limit]
  );
  return result.rows;
}

async function getDistinctYears(charityId) {
  const result = await pool.query(
    `SELECT DISTINCT TO_CHAR(date::date, 'YYYY') AS year
     FROM transactions
     WHERE date IS NOT NULL AND charity_id = $1
     ORDER BY year DESC`,
    [charityId]
  );
  return result.rows.map(r => r.year);
}

async function importBankTransaction({ date, description, transactionType, paidIn, paidOut, sourceRef, charityId }) {
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
    'SELECT id, type FROM transactions WHERE notes = $1 AND charity_id = $2',
    [sourceRef, charityId]
  );
  if (existing.rows[0]) {
    if (inferredType && !existing.rows[0].type) {
      await pool.query('UPDATE transactions SET type = $1 WHERE id = $2', [inferredType, existing.rows[0].id]);
    }
    return false;
  }
  await pool.query(
    `INSERT INTO transactions (date, transaction_type, type, description, paid_in, paid_out, notes, charity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [date, transactionType, inferredType, description, paidIn || null, paidOut || null, sourceRef, charityId]
  );
  return true;
}

async function getCharityById(charityId) {
  const result = await pool.query('SELECT * FROM charities WHERE id = $1', [charityId]);
  return result.rows[0] || null;
}

async function updateCharity(charityId, { name, email, phone, website, charity_no, treasurer_name, address }) {
  await pool.query(
    `UPDATE charities SET name=$1, email=$2, phone=$3, website=$4, charity_no=$5, treasurer_name=$6, address=$7 WHERE id=$8`,
    [name, email, phone, website, charity_no, treasurer_name, address, charityId]
  );
}

async function updateCharityLogo(charityId, logoPath) {
  await pool.query(`UPDATE charities SET logo_path=$1 WHERE id=$2`, [logoPath, charityId]);
}

async function getTopDonors(year, limit, charityId) {
  const result = await pool.query(`
    SELECT first_name, surname, SUM(amount::FLOAT) AS total
    FROM donations
    WHERE TO_CHAR(date::date, 'YYYY') = $1 AND charity_id = $2
    GROUP BY member_id, first_name, surname
    ORDER BY total DESC
    LIMIT $3
  `, [String(year), charityId, limit]);
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
  getCharityById,
  updateCharity,
  updateCharityLogo,
};
