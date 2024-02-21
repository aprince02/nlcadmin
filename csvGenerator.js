const os = require('os');
var db = require("./database.js")
const csv = require('csv-parser');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;

async function exportDonationsCsv(req, res) {
  const tableName = 'donations';
  try {
      const rows = await new Promise((resolve, reject) => {
          db.all(`SELECT * FROM ${tableName}`, function(err, rows) {
              if (err) {
                  console.error('Error retrieving data to export donations:', err);
                  reject(err);
              } else {
                  resolve(rows);
              }});
      });
      const csvWrite = csvWriter({
          path: 'donations.csv',
          header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
      });
      await csvWrite.writeRecords(rows);
      console.log('Donations successfully exported');
  } catch (error) {
      console.error('Error exporting donations CSV:', error);
  }};

  async function exportGiftAidClaimCsv(req, res) {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all(`SELECT members.first_name, members.surname, donations.amount, donations.date, 
                members.title, members.house_number, members.postcode
                FROM donations 
                INNER JOIN members ON donations.member_id = members.id 
                WHERE donations.gift_aid_status = 'Unclaimed'`, function(err, rows) {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }});
      });
      const csvWrite = csvWriter({
        path: 'giftaid_claim.csv',
        header: [
          { id: 'title', title: 'Title' },  
          { id: 'first_name', title: 'First Name' },
          { id: 'surname', title: 'Surname' },
          { id: 'house_number', title: 'House Number' },
          { id: 'postcode', title: 'Postcode' },
          { id: 'date', title: 'Date' },
          { id: 'amount', title: 'Amount' }
        ]
      });
      await csvWrite.writeRecords(rows);
      console.log('Gift Aid Claim CSV successfully exported');
    } catch (error) {
      console.error('Error exporting gift aid claim CSV:', error);
      req.flash('error', 'Error generating CSV file for gift aid claim.');
    }
  }

async function writeTotalPaidInOutCsv(types, totalPaidInByType, totalPaidOutByType) {
    const csvFilePath = "total_paid_in_out.csv";
    const csvWriterOptions = {
        path: csvFilePath,
        header: [
            { id: "type", title: "Type" },
            { id: "paid_in", title: "Paid In" },
            { id: "paid_out", title: "Paid Out" }
        ]
    };
    const dataToWrite = types.map(type => ({
        type: type,
        paid_in: totalPaidInByType[type],
        paid_out: totalPaidOutByType[type]
    }));
    const writer = csvWriter(csvWriterOptions);
    await writer.writeRecords(dataToWrite);
    console.log("CSV file has been written successfully.");
}

module.exports = {
  exportDonationsCsv,
  exportGiftAidClaimCsv,
  writeTotalPaidInOutCsv
}