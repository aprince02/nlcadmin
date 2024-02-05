// transactionTypes.js

let transactionTypes = [
    'Tithe', 'Offering', 'Church Building', 'Vehicle', 'Building Rent',
    'Ladies Fund', 'Sunday School Offering', 'Guest Pastor', 'Support & Charity',
    'Audio/Visual/Licenses', 'Books & Stationary', 'Provisions', 'Gifts', 'Other Income',
    'Gift Aid Claim', 'VBS', 'Evangelism', 'AoG', 'Legal', 'Anniversary',
    'Membership Interest Free Loan', 'Other Donations', 'Live Music Event', 'Bank Charges'
  ];
  
  function addTransactionType(newType) {
    // Check if the type already exists to avoid duplicates
    if (!transactionTypes.includes(newType)) {
      transactionTypes.push(newType);
      return true; // Type added successfully
    } else {
      return false; // Type already exists
    }
  }
  
  module.exports = {
    transactionTypes,
    addTransactionType
  };
  