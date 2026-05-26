const xlsx = require('xlsx');

function peek(file) {
    console.log(`\n--- ${file} ---`);
    try {
        const workbook = xlsx.readFile(file);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log('Headers:', data[0]);
        console.log('Row 1:', data[1]);
        console.log('Total Rows:', data.length);
    } catch (e) {
        console.error('Error reading', file, e.message);
    }
}

peek('FORM FUNIL/20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx');
