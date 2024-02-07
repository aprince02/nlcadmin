// pdf.js
const { jsPDF } = require("jspdf");
const fs = require("fs");
const { autoTable } = require("jspdf-autotable");
const { log } = require('./utils');

async function generatePDF(donor, tithe, donations) {
  const doc = new jsPDF();

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
  doc.text('NewLife Church Sunderland', 135, 10);
  doc.setFontSize(12);
  doc.text('Tel: 07737188124', 135, 15);
  doc.text('Email: info@nlcsunderland.uk', 135, 20);
  doc.text('Web: www.nlcsunderland.uk', 135, 25);
  doc.text('Charity No. 117881', 135, 30);
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
  doc.text("01/01/2023 - 31/12/2023", 90, 70)
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
    const row = [`${tithe[i].date}`, `£${tithe[i].amount}`];
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
    const row = [`${donations[i].date}`, `${donations[i].fund}`, `£${donations[i].amount}`];
    donationsBody.push(row);
  }

  const donationTable = doc.autoTable( {
    head: [['Date', 'Fund', 'Amount']],
    body: donationsBody, startY: nextElementY + 1, theme: 'grid',
  })

  const donationTableEndY = donationTable.lastAutoTable.finalY;

  doc.setFontSize(10)
  doc.text("Thank you for your generous support, May God Bless You.", 10, donationTableEndY + 15)
  doc.text("Shinu Yohannan", 10, donationTableEndY + 25)
  doc.setFontSize(9)
  doc.text("Treasurer", 10, donationTableEndY + 30)

  const fileName = `${fullName} - Statement of Donations.pdf`;
  const pdfPath = fileName;
  doc.autoPrint();
  doc.save(fileName);
  log( `Tithe/Donations PDF generated for ${fullName}`)
  return pdfPath;
}

module.exports = { generatePDF };
