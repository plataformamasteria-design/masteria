const xlsx = require('xlsx');

try {
  const wb = xlsx.readFile('kommo_export_leads_2026-05-11.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const structure = {};
  data.forEach(row => {
    const funnel = row['Funil de vendas'];
    const stage = row['Etapa do lead'];
    if (funnel && stage) {
      if (!structure[funnel]) structure[funnel] = new Set();
      structure[funnel].add(stage);
    }
  });

  console.log("=== ESTRUTURA DE FUNIS E ETAPAS ===");
  Object.keys(structure).forEach(f => {
    console.log(`Funil: ${f}`);
    console.log("Etapas:");
    Array.from(structure[f]).forEach(s => console.log(`  - ${s}`));
  });

} catch (err) {
  console.error("Erro ao ler arquivo:", err);
}
