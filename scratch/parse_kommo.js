const xlsx = require('xlsx');

try {
  const wb = xlsx.readFile('kommo_export_leads_2026-05-11.xlsx');
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  if (data.length === 0) {
    console.log("Arquivo vazio.");
    process.exit(0);
  }

  const headers = Object.keys(data[0]);
  console.log("=== CABEÇALHOS (Colunas) ===");
  console.log(headers);

  // Tentando identificar a coluna de etapa
  const stageColumn = headers.find(h => h.toLowerCase().includes('etapa') || h.toLowerCase().includes('status') || h.toLowerCase().includes('pipeline') || h.toLowerCase().includes('funil'));
  
  if (stageColumn) {
    console.log(`\n=== ETAPAS ENCONTRADAS (Coluna: ${stageColumn}) ===`);
    const stages = [...new Set(data.map(r => r[stageColumn]).filter(Boolean))];
    console.log(stages);
  } else {
    console.log("\nNão foi possível identificar automaticamente a coluna de 'etapa' do funil.");
  }

  console.log("\n=== EXEMPLO DA PRIMEIRA LINHA ===");
  console.log(data[0]);

} catch (err) {
  console.error("Erro ao ler arquivo:", err);
}
