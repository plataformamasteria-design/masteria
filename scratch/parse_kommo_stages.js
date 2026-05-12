const xlsx = require('xlsx');

try {
  const wb = xlsx.readFile('kommo_export_leads_2026-05-11.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log("=== PRIMEIRAS 3 LINHAS ===");
  console.log(JSON.stringify(data.slice(0, 3), null, 2));

} catch (err) {
  console.error("Erro ao ler arquivo:", err);
}
