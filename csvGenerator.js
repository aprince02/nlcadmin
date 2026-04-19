const pool = require("./database.js")
const csvWriter = require('csv-writer').createObjectCsvWriter;
const { formatPostcode } = require('./utils');

/** Format a date as DD/MM/YY for HMRC Gift Aid CSV. */
function hmrcDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy   = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

async function exportDonationsCsv(req, res) {
  try {
      const result = await pool.query('SELECT * FROM donations WHERE charity_id = $1', [req.charityId]);
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

async function exportGiftAidClaimCsv(req) {
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
          AND donations.charity_id = $1
    `, [req.charityId]);

    const headers = ['Title','First name','Last name','House name or number','Postcode','Aggregated donations','Sponsored event','Donation date','Amount'];
    const lines   = [headers.join(',')];

    donationsResult.rows.forEach(d => {
        lines.push([
            d.title || '', d.first_name || '', d.last_name || '',
            d.house_name_or_number || '', formatPostcode(d.postcode) || '',
            '', '',
            hmrcDate(d.donation_date), d.donation_amount || 0
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });

    return Buffer.from(lines.join('\n') + '\n', 'utf8');
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