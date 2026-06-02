/**
 * ANALISADOR DE ATENDIMENTOS - Clínica Dilascio's
 * Lê o dump JSON e classifica cada conversa por tipo de atendimento,
 * desfecho, palavras-chave e oportunidade.
 */
import * as fs from 'fs';

const raw = fs.readFileSync('scratch/dilascio_raw_dump.json', 'utf8');

// O arquivo começa com "TOTAL DE CONVERSAS: 263\n" antes do JSON
const jsonStart = raw.indexOf('[');
const jsonData: any[] = JSON.parse(raw.slice(jsonStart));

// Classificadores
function classifyConversation(conv: any) {
  const allText = conv.messages.map((m: any) => (m.content || '').toLowerCase()).join(' ');
  const firstMsg = conv.messages.find((m: any) => m.sender_type === 'CONTACT')?.content?.toLowerCase() || '';
  const lastMsg = conv.messages[conv.messages.length - 1];
  
  // Tipo de atendimento
  let type = 'outro';
  if (/agend|marcar|horário|hora|consulta|reservar|disponível/.test(allText)) type = 'agendamento';
  else if (/remarc|cancelar|desmarcar|trocar data|mudar horário/.test(allText)) type = 'reagendamento';
  else if (/confirm|lembrando|lembrete|não esqueça/.test(allText)) type = 'confirmação';
  else if (/plano|convênio|particular|unimed|hapvida|hap vida|amil|sulamerica|bradesco saude/.test(allText)) type = 'plano_saude';
  else if (/resultado|exame|laudo|retorno|como está|como foi/.test(allText)) type = 'retorno_pos_consulta';
  else if (/preço|valor|quanto|custo|orçamento/.test(allText)) type = 'dúvida_financeira';
  else if (/endereço|onde fica|localização|como chegar/.test(allText)) type = 'informação_local';
  else if (/oi|olá|bom dia|boa tarde|boa noite/.test(firstMsg) && conv.msg_count <= 3) type = 'sondagem_inicial';

  // Desfecho
  let outcome = 'indefinido';
  const lastContent = (lastMsg?.content || '').toLowerCase();
  if (/✅|ok|confirmad|confirmei|até|anotado|obrigad|combinado|pronto|marcado/.test(lastContent)) outcome = 'positivo';
  else if (/não|nao|cancelei|não tem|não posso|não consigo/.test(lastContent)) outcome = 'negativo';
  else if (conv.msg_count <= 2) outcome = 'sem_resposta';
  else outcome = 'em_aberto';

  // Plano de saúde mencionado
  const plano = (() => {
    if (/hapvida|hap vida/.test(allText)) return 'Hapvida';
    if (/unimed/.test(allText)) return 'Unimed';
    if (/amil/.test(allText)) return 'Amil';
    if (/sulamerica|sul america/.test(allText)) return 'SulAmérica';
    if (/bradesco/.test(allText)) return 'Bradesco Saúde';
    if (/particular/.test(allText)) return 'Particular';
    return null;
  })();

  // Pediu horário específico?
  const pedidoHorario = /\d{1,2}h|\d{1,2}:\d{2}|manhã|tarde|noite|antes das|depois das/.test(allText);

  // Urgência / sintoma mencionado
  const urgencia = /urgente|emergência|dor|febre|pressão|mal estar|não aguento/.test(allText);

  // Dias sem resposta
  const lastMsgDate = new Date(conv.last_message_at);
  const now = new Date('2026-05-28T21:40:00');
  const diasSemInteracao = Math.floor((now.getTime() - lastMsgDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    conv_id: conv.conv_id,
    contact_name: conv.contact_name,
    contact_phone: conv.contact_phone,
    msg_count: conv.msg_count,
    inbound: conv.inbound_count,
    outbound: conv.outbound_count,
    created_at: conv.created_at,
    last_message_at: conv.last_message_at,
    type,
    outcome,
    plano,
    pedidoHorario,
    urgencia,
    diasSemInteracao,
    ai_active: conv.ai_active,
    firstMsg: conv.messages.find((m: any) => m.sender_type === 'CONTACT')?.content?.slice(0, 200) || '',
    lastMsg: lastMsg?.content?.slice(0, 200) || '',
    lastMsgFrom: lastMsg?.sender_type || '',
  };
}

const analyzed = jsonData.map(classifyConversation);

// Estatísticas gerais
const stats = {
  total: analyzed.length,
  byType: {} as Record<string, number>,
  byOutcome: {} as Record<string, number>,
  byPlano: {} as Record<string, number>,
  semResposta: 0,
  urgencias: 0,
  pedidosHorario: 0,
  frios: 0, // > 1 dia
  muitoFrios: 0, // > 5 dias
};

for (const a of analyzed) {
  stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
  stats.byOutcome[a.outcome] = (stats.byOutcome[a.outcome] || 0) + 1;
  if (a.plano) stats.byPlano[a.plano] = (stats.byPlano[a.plano] || 0) + 1;
  if (a.outcome === 'sem_resposta') stats.semResposta++;
  if (a.urgencia) stats.urgencias++;
  if (a.pedidoHorario) stats.pedidosHorario++;
  if (a.diasSemInteracao > 1) stats.frios++;
  if (a.diasSemInteracao > 5) stats.muitoFrios++;
}

console.log('\n=== ESTATÍSTICAS GERAIS ===');
console.log(JSON.stringify(stats, null, 2));

// Detalhar por tipo
console.log('\n=== AGENDAMENTOS ===');
const agendamentos = analyzed.filter(a => a.type === 'agendamento');
console.log(`Total: ${agendamentos.length}`);
for (const a of agendamentos) {
  console.log(`  [${a.outcome.toUpperCase()}] ${a.contact_name} | ${a.contact_phone} | msgs:${a.msg_count} | último:${a.last_message_at}`);
  console.log(`    Primeiro: "${a.firstMsg}"`);
  console.log(`    Último: "${a.lastMsg}" (de: ${a.lastMsgFrom})`);
}

console.log('\n=== REAGENDAMENTOS ===');
const reagendamentos = analyzed.filter(a => a.type === 'reagendamento');
console.log(`Total: ${reagendamentos.length}`);
for (const a of reagendamentos) {
  console.log(`  [${a.outcome.toUpperCase()}] ${a.contact_name} | ${a.contact_phone} | msgs:${a.msg_count}`);
  console.log(`    Último: "${a.lastMsg}" (de: ${a.lastMsgFrom})`);
}

console.log('\n=== CONFIRMAÇÕES ===');
const confirmacoes = analyzed.filter(a => a.type === 'confirmação');
console.log(`Total: ${confirmacoes.length}`);
for (const a of confirmacoes) {
  console.log(`  [${a.outcome.toUpperCase()}] ${a.contact_name} | ${a.contact_phone} | msgs:${a.msg_count}`);
  console.log(`    Último: "${a.lastMsg}"`);
}

console.log('\n=== PLANOS DE SAÚDE ===');
const planos = analyzed.filter(a => a.type === 'plano_saude');
console.log(`Total: ${planos.length}`);
for (const a of planos) {
  console.log(`  [${a.outcome.toUpperCase()}] ${a.contact_name} | Plano: ${a.plano} | msgs:${a.msg_count}`);
  console.log(`    Primeiro: "${a.firstMsg}"`);
  console.log(`    Último: "${a.lastMsg}"`);
}

console.log('\n=== URGÊNCIAS / SINTOMAS ===');
const urgencias = analyzed.filter(a => a.urgencia);
console.log(`Total: ${urgencias.length}`);
for (const a of urgencias) {
  console.log(`  ${a.contact_name} | ${a.contact_phone} | tipo:${a.type}`);
  console.log(`    "${a.firstMsg}"`);
}

console.log('\n=== LEADS FRIOS (sem interação > 1 dia, ainda abertos) ===');
const frios = analyzed.filter(a => a.diasSemInteracao > 1).sort((a, b) => b.diasSemInteracao - a.diasSemInteracao);
console.log(`Total: ${frios.length}`);
for (const a of frios) {
  console.log(`  ${a.diasSemInteracao}d - ${a.contact_name} | ${a.contact_phone} | msgs:${a.msg_count} | tipo:${a.type}`);
  console.log(`    Último: "${a.lastMsg}" (de: ${a.lastMsgFrom})`);
}

console.log('\n=== SEM NENHUMA RESPOSTA DO PACIENTE ===');
const semResposta = analyzed.filter(a => a.inbound === 0);
console.log(`Total: ${semResposta.length}`);
for (const a of semResposta) {
  console.log(`  ${a.contact_name} | ${a.contact_phone} | msgs:${a.msg_count}`);
  console.log(`    Último (IA): "${a.lastMsg}"`);
}

console.log('\n=== DESFECHOS NEGATIVOS (paciente disse NÃO ou cancelou) ===');
const negativos = analyzed.filter(a => a.outcome === 'negativo');
console.log(`Total: ${negativos.length}`);
for (const a of negativos) {
  console.log(`  ${a.contact_name} | ${a.contact_phone} | tipo:${a.type}`);
  console.log(`    Primeiro: "${a.firstMsg}"`);
  console.log(`    Último: "${a.lastMsg}"`);
}

console.log('\n=== PEDIDOS DE HORÁRIO ESPECÍFICO ===');
const horarios = analyzed.filter(a => a.pedidoHorario);
console.log(`Total: ${horarios.length}`);
for (const a of horarios) {
  console.log(`  [${a.outcome.toUpperCase()}] ${a.contact_name} | ${a.contact_phone}`);
  console.log(`    "${a.firstMsg}"`);
}

console.log('\n=== CONVERSAS APENAS COM A IA (SEM AGENTE HUMANO) ===');
const somenteIA = analyzed.filter(a => a.ai_active && a.outbound > 0 && a.inbound > 0);
console.log(`Total (IA respondeu + paciente respondeu): ${somenteIA.length}`);

console.log('\n=== RESUMO FINAL ===');
console.log(`Total conversas analisadas: ${analyzed.length}`);
console.log(`Agendamentos: ${stats.byType['agendamento'] || 0}`);
console.log(`Reagendamentos: ${stats.byType['reagendamento'] || 0}`);
console.log(`Confirmações: ${stats.byType['confirmação'] || 0}`);
console.log(`Planos de saúde: ${stats.byType['plano_saude'] || 0}`);
console.log(`Dúvidas financeiras: ${stats.byType['dúvida_financeira'] || 0}`);
console.log(`Retorno pós-consulta: ${stats.byType['retorno_pos_consulta'] || 0}`);
console.log(`Informações de local: ${stats.byType['informação_local'] || 0}`);
console.log(`Sondagem inicial: ${stats.byType['sondagem_inicial'] || 0}`);
console.log(`Outros: ${stats.byType['outro'] || 0}`);
console.log('');
console.log(`Desfecho POSITIVO: ${stats.byOutcome['positivo'] || 0}`);
console.log(`Desfecho NEGATIVO: ${stats.byOutcome['negativo'] || 0}`);
console.log(`Desfecho EM ABERTO: ${stats.byOutcome['em_aberto'] || 0}`);
console.log(`Sem resposta: ${stats.byOutcome['sem_resposta'] || 0}`);
console.log('');
console.log(`Leads frios (>1 dia): ${stats.frios}`);
console.log(`Leads muito frios (>5 dias): ${stats.muitoFrios}`);
console.log(`Urgências/sintomas: ${stats.urgencias}`);
console.log(`Pedidos de horário específico: ${stats.pedidosHorario}`);
console.log(`Planos mencionados:`, JSON.stringify(stats.byPlano));

process.exit(0);
