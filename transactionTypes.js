const dbHelper = require('./dbHelper');

async function getAllTransactionTypes() {
  try {
    return await dbHelper.getAllTransactionTypes();
  } catch (error) {
    console.error('Error fetching transaction types from the database:', error);
    return [];
  }
}

module.exports = {
  getAllTransactionTypes,
};
