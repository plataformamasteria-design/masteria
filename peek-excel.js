const xlsx = require('xlsx');

function peek(file) {
    console.log(`\n--- ${file} ---`);
    const workbook = xlsx.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Headers:', data[0]);
    console.log('Row 1:', data[1]);
    console.log('Total Rows:', data.length);
}

peek('Kommo/kommo_export_leads_2026-05-25 (4).xlsx');
