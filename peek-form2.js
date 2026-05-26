const xlsx = require('xlsx');

function peek(file) {
    console.log(`\n--- ${file} ---`);
    try {
        const workbook = xlsx.readFile(file);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log('Headers:', data[0]);
    } catch (e) {
        console.error('Error reading', file, e.message);
    }
}

peek('FORM FUNIL/20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx');
peek('FORM FUNIL/20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx');
peek('FORM FUNIL/20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx');
