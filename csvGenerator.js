const os = require('os');
const pool = require("./database.js")
const csv = require('csv-parser');
const fs = require('fs');
const csvWriter = require('csv-writer').createObjectCsvWriter;

async function exportDonationsCsv(req, res) {
  try {
      const result = await pool.query('SELECT * FROM donations');
      const rows = result.rows;
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
        // Exporting Donations data
        const donationsResult = await pool.query(`
            SELECT
                members.title,
                members.first_name,
                members.surname AS last_name,
                members.house_number AS house_name_or_number,
                members.postcode,
                donations.amount AS donation_amount,
                donations.date AS donation_date
            FROM donations
            INNER JOIN members ON donations.member_id = members.id
            WHERE donations.gift_aid_status = 'Unclaimed'
        `);
        const donationsData = donationsResult.rows;

        // Exporting Offering Claim data
        const offeringResult = await pool.query(`
            SELECT
                offering_claim.date AS offering_date,
                offering_claim.amount AS offering_amount
            FROM offering_claim
        `);
        const offeringClaimData = offeringResult.rows;

        // Prepare CSV data with donations first, followed by offering claims
        const csvData = [];

        // Add Donations Data first
        donationsData.forEach(donation => {
            csvData.push({
                title: donation.title,
                first_name: donation.first_name,
                last_name: donation.last_name,
                house_name_or_number: donation.house_name_or_number,
                postcode: donation.postcode,
                aggregated_donations: donation.donation_amount || 0,
                sponsored_event: '',  // Placeholder for sponsored event
                donation_date: donation.donation_date,
                amount: donation.donation_amount || 0
            });
        });

        // Then, add Offering Claim Data with the required format
        offeringClaimData.forEach(claim => {
            csvData.push({
                title: '',  // Empty for offerings
                first_name: '',  // Empty for offerings
                last_name: '',  // Empty for offerings
                house_name_or_number: '',  // Empty for offerings
                postcode: '',  // Empty for offerings
                aggregated_donations: "Sunday Collection Bucket",  // Fixed value
                sponsored_event: '',  // Empty for offerings
                donation_date: claim.offering_date,  // Use offering date
                amount: claim.offering_amount  // Use offering amount
            });
        });

        // Writing merged data to CSV
        const csvWrite = csvWriter({
            path: 'giftaid_claim.csv',
            header: [
                { id: 'title', title: 'Title' },
                { id: 'first_name', title: 'First name' },
                { id: 'last_name', title: 'Last name' },
                { id: 'house_name_or_number', title: 'House name or number' },
                { id: 'postcode', title: 'Postcode' },
                { id: 'aggregated_donations', title: 'Aggregated donations' },
                { id: 'sponsored_event', title: 'Sponsored event' },
                { id: 'donation_date', title: 'Donation date' },
                { id: 'amount', title: 'Amount' }
            ]
        });

        await csvWrite.writeRecords(csvData);
        console.log('Gift Aid Claim CSV successfully exported');
        req.flash('success', 'Gift Aid Claim CSV successfully exported');
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