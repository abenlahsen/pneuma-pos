const xlsx = require('xlsx');
const wb = xlsx.readFile('./Achat_Pneus.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
console.log(JSON.stringify(xlsx.utils.sheet_to_json(sheet).slice(0, 5), null, 2));
