const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('d:/projects/pneuma-pos/Vente Pneu 2026.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length > 0) {
    console.log('--- HEADERS ---');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('--- FIRST ROW ---');
    console.log(JSON.stringify(data[1] || {}, null, 2));
  } else {
    console.log('Excel file is empty.');
  }
} catch (error) {
  console.error('Error reading Excel file:', error);
}
