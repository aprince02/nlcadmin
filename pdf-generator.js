// pdf.js
const { jsPDF } = require("jspdf");
const fs = require("fs");
const { autoTable } = require("jspdf-autotable");
const { log } = require('./utils');

/** Format any date value as DD-MM-YYYY. Uses UTC to avoid timezone shifts on DATE-only values. */
function fmtDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function generatePDF(donor, tithe, donations, charity = {}) {
  const doc = new jsPDF({ compress: true });

  const logoPath = "css/logo.png";
  const logoData = fs.readFileSync(logoPath);
  const fullName = donor.first_name + ' ' + donor.surname;
  
  let totalAmount = 0;
  let giftaidClaimed = 0;
    donations.forEach((row) => {
      totalAmount += row.amount;
      if (row.gift_aid_status === 'Claimed') {
        giftaidClaimed += row.amount;
      }
    });
    tithe.forEach((row) => {
      totalAmount += row.amount;
      if (row.gift_aid_status === 'Claimed') {
        giftaidClaimed += row.amount;
      }
    });
  const totalDonation = `£${totalAmount}`;
  const giftaidClaimedTotal = `£${giftaidClaimed * 0.25}`

  doc.addImage(logoData, "PNG", 1, 1, 35, 35);
  doc.text(charity.name || '', 135, 10);
  doc.setFontSize(12);
  doc.text(charity.phone    ? 'Tel: '    + charity.phone    : '', 135, 15);
  doc.text(charity.email    ? 'Email: '  + charity.email    : '', 135, 20);
  doc.text(charity.website  ? 'Web: '    + charity.website  : '', 135, 25);
  doc.text(charity.charity_no ? 'Charity No. ' + charity.charity_no : '', 135, 30);
  doc.line(0, 37, 250, 38, 'S')
  doc.text(fullName,10, 43 )
  doc.setFontSize(8)
  doc.setTextColor('#7d7d81');
  doc.text("Probooks Accounting © - Alpha Media Productions Ltd.", 135, 43);
  doc.setFontSize(12);
  doc.setTextColor('#000000');
  doc.text(donor.house_number + ' ' + donor.address_line_1, 10, 48)
  doc.text(donor.postcode, 10, 53)
  doc.text("Statement of Tithe/Donations", 10, 65)
  doc.setFontSize(10);
  doc.text("Period:", 10, 70)
  doc.text("01/01/2024 - 31/12/2024", 90, 70)
  doc.text("Total Tithe/Donations:", 10, 75)
  doc.text(totalDonation, 90, 75)
  doc.text("Gift Aid Claimed:", 10, 80)
  doc.text(giftaidClaimedTotal, 90, 80)
  
  doc.setFontSize(15)
  const options = {
    underline: true
  };

  doc.textWithLink("Tithe", 95, 99, options);
  doc.setFontSize(10)

  const titheBody = []; 

  for (let i = 0; i < tithe.length; i++) {
    const row = [fmtDate(tithe[i].date), `£${tithe[i].amount}`];
    titheBody.push(row);
  }

  const titheTable = doc.autoTable( {
    head: [['Date', 'Amount']],
    body: titheBody, startY: 100, theme: 'grid',
  })

  const titheTableEndY = titheTable.lastAutoTable.finalY;

  const margin = 15;
  const nextElementY = titheTableEndY + margin;
  doc.setFontSize(15)
  doc.text('Donations', 90, nextElementY);

  const donationsBody = [];

  for (let i = 0; i < donations.length; i++) {
    const row = [fmtDate(donations[i].date), `${donations[i].fund}`, `£${donations[i].amount}`];
    donationsBody.push(row);
  }

  const donationTable = doc.autoTable( {
    head: [['Date', 'Fund', 'Amount']],
    body: donationsBody, startY: nextElementY + 1, theme: 'grid',
  })

  const donationTableEndY = donationTable.lastAutoTable.finalY;

  doc.setFontSize(10)
  doc.text("Thank you for your generous support, May God Bless You.", 10, donationTableEndY + 15)
  doc.text("Rejoy Varghese", 10, donationTableEndY + 25)
  doc.setFontSize(9)
  doc.text("Treasurer", 10, donationTableEndY + 30)

  const fileName = `${fullName} - Statement of Donations.pdf`;
  const pdfPath = fileName;
  doc.autoPrint();
  doc.save(fileName);
  log( `Tithe/Donations PDF generated for ${fullName}`)
  return pdfPath;
}

async function generateTransactionPDF(transactions) {
  const doc = new jsPDF();

  const logoPath = "css/probooks-statementOfTransactions.png";
  const logoData = fs.readFileSync(logoPath);

  const pageWidth = doc.internal.pageSize.getWidth();
  const logoWidth = 150;
  const logoHeight = 150;
  const logoX = (pageWidth - logoWidth) / 2;

  doc.addImage(logoData, "PNG", logoX, 10, logoWidth, logoHeight);
  doc.setFontSize(12);

  const groupedTransactions = {};
  transactions.forEach(transaction => {
    if (!groupedTransactions[transaction.type]) {
      groupedTransactions[transaction.type] = [];
    }
    groupedTransactions[transaction.type].push(transaction);
  });

  let startY = 10;
  for (const [type, typeTransactions] of Object.entries(groupedTransactions)) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text(type, 6, startY);
    doc.setFontSize(4);

    const body = typeTransactions.map(transaction => {
      const paidOut = typeof transaction.paid_out === 'number' ? transaction.paid_out : parseFloat(transaction.paid_out || 0);
      const paidIn  = typeof transaction.paid_in  === 'number' ? transaction.paid_in  : parseFloat(transaction.paid_in  || 0);
      return [fmtDate(transaction.date), transaction.description, paidOut, paidIn];
    });

    const totalPaidIn  = body.reduce((total, [, , , paidIn])  => total + paidIn,  0);
    const totalPaidOut = body.reduce((total, [, , paidOut])    => total + paidOut, 0);
    body.push(['', 'Total', totalPaidOut, totalPaidIn]);

    doc.autoTable({
      head: [['Date', 'Description', 'Paid Out', 'Paid In']],
      body,
      startY: startY + 5,
      theme: 'grid',
    });
  }

  console.log('Statement of Transactions PDF generated');
  return Buffer.from(doc.output('arraybuffer'));
}




async function generateDonationsPDF(donations, { fund, startDate, endDate } = {}, charity = {}) {
  const doc = new jsPDF();

  const logoPath = "css/logo.png";
  const logoData = fs.readFileSync(logoPath);

  // ── Header ──────────────────────────────────────────────────────
  doc.addImage(logoData, "PNG", 1, 1, 35, 35);
  doc.setFontSize(12);
  doc.text(charity.name || '', 135, 10);
  doc.setFontSize(10);
  doc.text(charity.phone    ? 'Tel: '    + charity.phone    : '', 135, 16);
  doc.text(charity.email    ? 'Email: '  + charity.email    : '', 135, 21);
  doc.text(charity.website  ? 'Web: '    + charity.website  : '', 135, 26);
  doc.text(charity.charity_no ? 'Charity No. ' + charity.charity_no : '', 135, 31);
  doc.line(0, 37, 250, 38, 'S');

  doc.setFontSize(14);
  doc.text('Donations Export', 10, 45);

  doc.setFontSize(9);
  doc.setTextColor('#555555');
  const dateLabel = (startDate ? fmtDate(startDate) : '—') + ' to ' + (endDate ? fmtDate(endDate) : '—');
  const fundLabel  = fund && fund !== 'all' ? fund : 'All Funds';
  doc.text(`Period: ${dateLabel}     Fund: ${fundLabel}`, 10, 52);
  doc.setTextColor('#000000');

  // ── Fund totals summary table ────────────────────────────────────
  const fundTotals = {};
  const fundCounts = {};
  let grandTotal = 0;

  donations.forEach(r => {
    const f   = r.fund || 'Unknown';
    const amt = parseFloat(r.amount) || 0;
    fundTotals[f] = (fundTotals[f] || 0) + amt;
    fundCounts[f] = (fundCounts[f] || 0) + 1;
    grandTotal    += amt;
  });

  const summaryBody = Object.keys(fundTotals).sort().map(f => [
    f,
    fundCounts[f],
    '£' + fundTotals[f].toFixed(2),
  ]);
  summaryBody.push(['Total', donations.length, '£' + grandTotal.toFixed(2)]);

  doc.autoTable({
    head:         [['Fund', 'Donations', 'Total']],
    body:          summaryBody,
    startY:        57,
    theme:        'grid',
    styles:        { fontSize: 9 },
    columnStyles:  { 1: { halign: 'center' }, 2: { halign: 'right' } },
    headStyles:    { fillColor: [40, 80, 160] },
  });

  const summaryEndY = doc.lastAutoTable.finalY;

  // ── Detailed donations table ─────────────────────────────────────
  doc.setFontSize(11);
  doc.text('Donation Details', 10, summaryEndY + 10);

  const detailBody = donations.map(r => [
    fmtDate(r.date),
    ((r.first_name || '') + ' ' + (r.surname || '')).trim(),
    r.fund            || '',
    r.gift_aid_status || '',
    r.notes           || '',
    '£' + (parseFloat(r.amount) || 0).toFixed(2),
  ]);

  doc.autoTable({
    head:         [['Date', 'Donor', 'Fund', 'Gift Aid', 'Notes', 'Amount']],
    body:          detailBody,
    startY:        summaryEndY + 14,
    theme:        'grid',
    styles:        { fontSize: 8 },
    columnStyles:  { 5: { halign: 'right' } },
    headStyles:    { fillColor: [40, 80, 160] },
  });

  doc.setFontSize(8);
  doc.setTextColor('#888888');
  doc.text(
    `Generated ${fmtDate(new Date())} — ${donations.length} record(s)`,
    10,
    doc.lastAutoTable.finalY + 8,
  );

  console.log(`Donations PDF generated (${donations.length} rows)`);
  return Buffer.from(doc.output('arraybuffer'));
}

async function generateTotalsPDF(types, totalPaidInByType, totalPaidOutByType, { startDate, endDate } = {}, charity = {}) {
  const doc = new jsPDF();

  const logoPath = "css/logo.png";
  const logoData = fs.readFileSync(logoPath);

  doc.addImage(logoData, "PNG", 1, 1, 35, 35);
  doc.setFontSize(12);
  doc.text(charity.name || '', 135, 10);
  doc.setFontSize(10);
  doc.text(charity.phone    ? 'Tel: '    + charity.phone    : '', 135, 16);
  doc.text(charity.email    ? 'Email: '  + charity.email    : '', 135, 21);
  doc.text(charity.website  ? 'Web: '    + charity.website  : '', 135, 26);
  doc.text(charity.charity_no ? 'Charity No. ' + charity.charity_no : '', 135, 31);
  doc.line(0, 37, 250, 38, 'S');

  doc.setFontSize(14);
  doc.text('Transaction Totals Export', 10, 45);

  doc.setFontSize(9);
  doc.setTextColor('#555555');
  const dateLabel = (startDate ? fmtDate(startDate) : '—') + ' to ' + (endDate ? fmtDate(endDate) : '—');
  doc.text(`Period: ${dateLabel}`, 10, 52);
  doc.setTextColor('#000000');

  let grandPaidIn  = 0;
  let grandPaidOut = 0;
  const body = types.map(type => {
    const paidIn  = totalPaidInByType[type]  || 0;
    const paidOut = totalPaidOutByType[type] || 0;
    grandPaidIn  += paidIn;
    grandPaidOut += paidOut;
    return [type, '£' + paidIn.toFixed(2), '£' + paidOut.toFixed(2)];
  });
  body.push(['Total', '£' + grandPaidIn.toFixed(2), '£' + grandPaidOut.toFixed(2)]);

  doc.autoTable({
    head:         [['Type', 'Paid In', 'Paid Out']],
    body,
    startY:        57,
    theme:        'grid',
    styles:        { fontSize: 9 },
    columnStyles:  { 1: { halign: 'right' }, 2: { halign: 'right' } },
    headStyles:    { fillColor: [40, 80, 160] },
  });

  doc.setFontSize(8);
  doc.setTextColor('#888888');
  doc.text(
    `Generated ${fmtDate(new Date())} — ${types.length} type(s)`,
    10,
    doc.lastAutoTable.finalY + 8,
  );

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { generatePDF, generateTransactionPDF, generateDonationsPDF, generateTotalsPDF };
