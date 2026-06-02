function extractFunnelFromUTM(row: any): string | null {
  const utmKey = Object.keys(row).find(k => k.toLowerCase().includes('utm_campaign') || k.toLowerCase().includes('utm campaing') || k.toLowerCase().includes('utm campaign'));
  
  if (!utmKey) return null;
  const utmValue = String(row[utmKey] || '').toUpperCase();
  
  if (!utmValue) return null;

  if (utmValue.includes('EVENTO-GCR') || utmValue.includes('GCR')) {
    return 'FUNIL EVENTO GCR';
  }
  if (utmValue.includes('ENCONTRO DE NEGOCIOS') || utmValue.includes('ENCONTRO PARA CASAIS')) {
    return 'FUNIL ENCONTRO DE CASAIS';
  }
  if (utmValue.includes('EDN')) {
    return 'FUNIL EDN [ATUAL]';
  }
  if (utmValue.includes('MENTORIA')) {
    return 'FUNIL MENTORIA';
  }
  
  return null;
}

const mockRows = [
  { 'UTM Campaing': '[HL] [EVENTO-GCR] [ENDFORMS] [ABRIL] [CADASTRO] [CBO] [FORMS] [FRIO]' },
  { 'utm_campaign': '[HL] [ENDFORMS] [MAIO] [CADASTRO] [ENCONTRO DE NEGOCIOS] [ABO] [FORMS] [FRIO]' },
  { 'UTM Campaign': '[HL] [MAYARA] [EVENTO-CASAL DE NEGOCIOS] [ENDFORMS] [MAIO] [CADASTRO] [CBO] [FORMS] [FRIO]' },
  { 'utm campaing': '[HL] [EDN] [JULHO] [LAL]' },
  { 'Funil de vendas': 'Should be ignored because it has no UTM' }
];

mockRows.forEach((row, i) => {
  console.log(`Row ${i + 1}:`, extractFunnelFromUTM(row));
});
