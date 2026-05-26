import xlsx from 'xlsx';

const workbook = xlsx.readFile('C:\\Users\\Administrator\\Desktop\\MASTER-IA-PROJECT\\FORM FUNIL\\20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, any>[];

if (rows.length > 0) {
    console.log('Sample row data column:', rows[0]['Data'] || rows[0]['Data de criação']);
    
    const str = String(rows[0]['Data'] || rows[0]['Data de criação']).trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
        console.log('Format 1 match:', new Date(str.replace(' ', 'T') + '-03:00')); 
    } else if (/^\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
        const [datePart, timePart] = str.split(' ');
        const [day, month, year] = datePart.split('.');
        console.log('Format 2 match:', new Date(`${year}-${month}-${day}T${timePart}-03:00`));
    } else {
        const d = new Date(str);
        console.log('Fallback parsing:', d);
    }
}
