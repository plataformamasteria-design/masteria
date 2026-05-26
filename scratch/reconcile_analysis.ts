require('dotenv').config({ path: '.env.local' });
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

// =====================================================
// CONFIGURATION
// =====================================================

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
const CUTOFF_DATE = new Date('2026-05-19T00:00:00-03:00');

const FUNNELS_CONFIG = [
  {
    name: 'FUNIL MENTORIA',
    boardId: '6bccc06c-4eb2-41e1-9c9d-5a133c267418',
    firstStageId: 'eb7468e0-580d-47bc-baa8-a5b38d697bfb',
    formFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx',
    kommoFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/Kommo/kommo_export_leads_2026-05-25 (3).xlsx',
    stageOrder: ['Lead Novo','Contato 01','Contato 02','Negociação','Conexão','Reagendamento Reunião','Reunião Agendada'],
    stageMap: {
      'lead novo': 'eb7468e0-580d-47bc-baa8-a5b38d697bfb',
      'contato 01': '92a03f35-fb1c-4257-bc19-2b995380edd7',
      'contato 02': '7f04f970-981e-4045-9bc9-c4542c198e1b',
      'negociação': 'de3ad812-5bb7-4d3b-aa17-7f99fad74ba0',
      'conexão': '4e7c60e3-a5ef-454e-8a51-4ae857f8f94e',
      'reagendamento reunião': '98beb641-cbaa-4109-8f2a-05c21152018b',
      'reunião agendada': '90880dac-8fbc-4f93-9a90-340a5c985487',
    },
    kommoPhoneField: 'Telefone comercial (contato)',
    kommoUserField: 'Lead usuário responsável',
    kommoStageField: 'Etapa do lead',
    formPhoneField: 'Descreva um número que podemos entrar em contato',
  },
  {
    name: 'FUNIL ENCONTRO DE CASAIS',
    boardId: '72e90627-1f9c-493e-a243-71ef668c021a',
    firstStageId: 'bf1ffdda-39ba-454e-85d8-0223098702d2',
    formFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx',
    kommoFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/Kommo/kommo_export_leads_2026-05-25 (5).xlsx',
    stageOrder: ['LEAD NOVO','Abordagem inicial','conexão','NEGOCIAÇÃO'],
    stageMap: {
      'lead novo': 'bf1ffdda-39ba-454e-85d8-0223098702d2',
      'abordagem inicial': 'becc6304-395b-4d17-8c25-e51905030413',
      'conexão': '98034d50-3532-40c5-b6f4-15c86ed3a471',
      'negociação': '53389f35-0118-4c26-b6f7-6024296e466a',
    },
    kommoPhoneField: 'Telefone comercial (contato)',
    kommoUserField: 'Lead usuário responsável',
    kommoStageField: 'Etapa do lead',
    formPhoneField: 'Qual seu Whatsapp?',
  },
  {
    name: 'FUNIL EVENTO GCR',
    boardId: 'b7f872be-03db-4e3a-832c-f7c746aa14cc',
    firstStageId: '42011dc3-3868-4b22-ab6c-5896e8352249',
    formFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx',
    kommoFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/Kommo/kommo_export_leads_2026-05-25 (6).xlsx',
    stageOrder: ['Lead Novo','1° Contato','2° Contato','3° Contato','4° Contato','5° Contato','Conexão','Reagendamento Reunião','Reunião Agendada','Negociação'],
    stageMap: {
      'lead novo': '42011dc3-3868-4b22-ab6c-5896e8352249',
      '1° contato': '9b860934-8b36-4eaf-a84c-fee27346d43a',
      '2° contato': 'ffe2a00d-b084-4af5-b1e1-44943821f15d',
      '3° contato': '7f12cbb4-fcce-4e5d-a3ad-da9c4977ec7c',
      '4° contato': '067caf3a-4f28-443e-8ef1-eef7a07dffc5',
      '5° contato': 'e551320b-59fc-4e3f-8499-20f334a38b4b',
      'conexão': 'c9d84b40-2d81-4829-8581-893b64f6df69',
      'reagendamento reunião': '2b273f82-0955-4dc1-9ec0-98b44126f12f',
      'reunião agendada': '91a04136-0a87-4270-b987-cf6d973fbf21',
      'negociação': 'd5bd2226-20e8-4673-b8e6-e5ac21c80bf7',
    },
    kommoPhoneField: null, // GCR has no phone in Kommo - match by name
    kommoUserField: 'Lead usuário responsável',
    kommoStageField: 'Etapa do lead',
    formPhoneField: 'Qual seu Whatsapp?',
  },
  {
    name: 'FUNIL EDN [ATUAL]',
    boardId: 'b8856169-d5ee-40ea-a876-20c8b46234cf',
    firstStageId: '591eedbd-d322-47fa-95f9-dba4697ef5ac',
    formFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/FORM FUNIL/20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx',
    kommoFile: 'C:/Users/Administrator/Desktop/MASTER-IA-PROJECT/Kommo/kommo_export_leads_2026-05-25 (4).xlsx',
    stageOrder: ['Lead Novo','Tent Contato 01','Tent Contato 02','Tent Contato 03','Tent Contato 04','Tent Contato 05','Reagendamento Reunião','Agendamento Desmarcado','Reunião agendada','NEGOCIAÇão','Venda ganha'],
    stageMap: {
      'lead novo': '591eedbd-d322-47fa-95f9-dba4697ef5ac',
      'tent contato 01': 'dfb2598e-9667-459c-a19f-3d9d6e3dd31a',
      'tent contato 02': '47b6e4b4-151c-4e79-9f8a-3aab6d51632d',
      'tent contato 03': '120da082-aec2-4a71-84bf-c8db1a03ba43',
      'tent contato 04': '3300e907-094f-4dbe-b7cb-371828230865',
      'tent contato 05': '57661970-6c56-4880-ae8b-3b3595a43360',
      'reagendamento reunião': 'd244c27b-3e95-45c2-ab58-d5a4ab6b87c2',
      'agendamento desmarcado': '680783d7-e68f-4b3b-ad62-7a1021945a1f',
      'reunião agendada': '0873fa6b-f847-491f-908d-aa310cd24d12',
      'negociação': 'f251c2d0-23e1-4ac4-9326-ba13eafedd6f',
      'venda ganha': 'cc28f4a0-f95e-426c-a76e-203bc69e5456',
    },
    kommoPhoneField: 'Telefone comercial (contato)',
    kommoUserField: null, // EDN has no user field - use 'Modificado por'? Actually check the columns
    kommoStageField: 'Etapa do lead',
    formPhoneField: 'Qual seu Whatsapp?',
  },
];

// User name → ID mapping
const KOMMO_USER_TO_ID: Record<string, string> = {
  'jorge junior': '7fe5892b-1c52-46cb-8d5a-6feb3caf0854',
  'anderson menezes': '7913c591-68e5-45f0-8e68-0c37c5673766',
  'murillo sano': 'b412d51b-f3d2-4624-8d1b-037ab0c5e195',
  'andrea adegas': '711659dd-6618-41b9-bd41-b79599941af2',
  'bruno macedo': '007729fc-205f-4976-8eac-58043d9c919f',
  'guilherme macedo': '6f2b009b-2faa-45a5-b4e8-52dd1ad3d898',
  'usuário teste': 'f7699afd-0cb7-40f2-8035-5fe4dbeffe83',
  'camila brandao': 'b29b0719-242f-4294-9189-6c5fb89ede63',
  'rafaela alves nogueira': '9c65c383-2569-45a0-8a10-6fa4874b1d30',
  // Renan Juste → null (does not exist)
};

// Valid sellers with active connections (per user instruction)
const VALID_SELLER_IDS = new Set([
  '7fe5892b-1c52-46cb-8d5a-6feb3caf0854', // Jorge Junior
  '711659dd-6618-41b9-bd41-b79599941af2', // Andrea Adegas
  '6f2b009b-2faa-45a5-b4e8-52dd1ad3d898', // Guilherme Macedo
  '007729fc-205f-4976-8eac-58043d9c919f', // Bruno Macedo
  '7913c591-68e5-45f0-8e68-0c37c5673766', // Anderson Menezes
  'f7699afd-0cb7-40f2-8035-5fe4dbeffe83', // Usuário Teste (Heitor Santos)
  'b29b0719-242f-4294-9189-6c5fb89ede63', // Camila Brandao
]);

const VALID_SELLER_LIST = Array.from(VALID_SELLER_IDS);

// Normalize phone: strip non-digits, ensure starts with 55
function normalizePhone(raw: any): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;
  return digits;
}

// Get stage index for comparison (higher = more advanced)
function getStageIndex(stageId: string, stageOrder: string[], stageMap: Record<string, string>): number {
  const entry = Object.entries(stageMap).find(([, v]) => v === stageId);
  if (!entry) return -1;
  const stageName = entry[0];
  const idx = stageOrder.findIndex(s => s.toLowerCase() === stageName);
  return idx === -1 ? -1 : idx;
}

async function main() {
  const { db } = await import('../src/lib/db');
  const { kanbanLeads, contacts, conversations } = await import('../src/lib/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  const report: any[] = [];
  let totalActions = 0;

  for (const config of FUNNELS_CONFIG) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${config.name}`);
    console.log('='.repeat(60));

    // Load Kommo data
    const kommoWb = xlsx.readFile(config.kommoFile);
    const kommoData: any[] = xlsx.utils.sheet_to_json(kommoWb.Sheets[kommoWb.SheetNames[0]]);
    
    // Filter out "Etapa de leads de entrada" (entry stage - ignore per user instructions)
    const kommoFiltered = kommoData.filter((r: any) => {
      const stage = (r[config.kommoStageField] || '').toLowerCase();
      return !stage.includes('entrada');
    });
    
    // Build phone → kommo row map
    const kommoByPhone = new Map<string, any>();
    const kommoByName = new Map<string, any>();
    for (const row of kommoFiltered) {
      const phone = config.kommoPhoneField ? normalizePhone(row[config.kommoPhoneField]) : null;
      if (phone) kommoByPhone.set(phone, row);
      const name = (row['Contato principal'] || row['Lead título'] || '').toLowerCase().trim();
      if (name) kommoByName.set(name, row);
    }
    console.log(`Kommo records (excluding entry stage): ${kommoFiltered.length}`);

    // Load Form data
    const formWb = xlsx.readFile(config.formFile);
    const formData: any[] = xlsx.utils.sheet_to_json(formWb.Sheets[formWb.SheetNames[0]]);
    const formByPhone = new Map<string, any>();
    for (const row of formData) {
      const phone = normalizePhone(row[config.formPhoneField]);
      if (phone) formByPhone.set(phone, row);
    }
    console.log(`Form records: ${formData.length}`);

    // Load all leads for this board
    const boardLeads = await db.query.kanbanLeads.findMany({
      where: eq(kanbanLeads.boardId, config.boardId),
      with: { contact: true },
    });
    console.log(`MasterIA leads: ${boardLeads.length}`);

    // Load all conversations for these contacts
    const contactIds = boardLeads.map((l: any) => l.contactId).filter(Boolean);
    let convByContactId: Record<string, any> = {};
    if (contactIds.length > 0) {
      const chunk = 500;
      for (let i = 0; i < contactIds.length; i += chunk) {
        const res = await db.query.conversations.findMany({
          where: and(
            eq(conversations.companyId, COMPANY_ID),
            inArray(conversations.contactId, contactIds.slice(i, i + chunk))
          ),
        });
        for (const c of res) {
          if (!convByContactId[c.contactId]) {
            convByContactId[c.contactId] = c;
          }
        }
      }
    }

    let stageUpdates = 0;
    let agentUpdates = 0;
    let orphans = 0;

    for (const lead of boardLeads) {
      const contact = (lead as any).contact;
      const phone = normalizePhone(contact?.phone);
      const contactName = (contact?.name || '').toLowerCase().trim();
      const leadCreatedAt = new Date(lead.createdAt);
      const isKommoEra = leadCreatedAt < CUTOFF_DATE;
      const conv = convByContactId[lead.contactId] || null;
      const currentAssignedTo = conv?.assignedTo || null;
      const currentStageId = lead.stageId;

      // Try to find in Kommo (match by phone, fallback to name)
      let kommoRow: any = null;
      if (phone) kommoRow = kommoByPhone.get(phone);
      if (!kommoRow && contactName) kommoRow = kommoByName.get(contactName);

      // Try to find in form
      let formRow: any = null;
      if (phone) formRow = formByPhone.get(phone);

      const source = kommoRow ? 'kommo' : (formRow ? 'form' : 'orphan');
      if (source === 'orphan') orphans++;

      const actions: any[] = [];

      // --- STAGE CORRECTION (only for Kommo leads) ---
      if (kommoRow) {
        const kommoStageName = (kommoRow[config.kommoStageField] || '').toLowerCase().trim();
        const targetStageId = config.stageMap[kommoStageName];

        if (targetStageId && targetStageId !== currentStageId) {
          // Compare stage advancement
          const currentIdx = getStageIndex(currentStageId, config.stageOrder, config.stageMap);
          const targetIdx = config.stageOrder.findIndex(s => s.toLowerCase() === kommoStageName);

          if (currentIdx < targetIdx) {
            // MasterIA is BEHIND Kommo → update to Kommo stage
            actions.push({
              type: 'stage_update',
              from: currentStageId,
              to: targetStageId,
              kommoStage: kommoRow[config.kommoStageField],
              reason: 'Kommo stage is more advanced than MasterIA',
            });
            stageUpdates++;
          } else if (currentIdx > targetIdx) {
            // MasterIA is AHEAD → preserve
            actions.push({
              type: 'stage_preserved',
              from: currentStageId,
              kommoStage: kommoRow[config.kommoStageField],
              reason: 'MasterIA stage is more advanced — preserved',
            });
          }
        }
      }

      // --- AGENT CORRECTION ---
      if (kommoRow && isKommoEra) {
        // Use Kommo responsible user
        const kommoUserRaw = config.kommoUserField ? kommoRow[config.kommoUserField] : null;
        const kommoUserKey = (kommoUserRaw || '').toLowerCase().trim();
        const targetUserId = KOMMO_USER_TO_ID[kommoUserKey] || null; // null if Renan Juste or unknown

        if (conv && currentAssignedTo !== targetUserId) {
          actions.push({
            type: 'agent_update',
            convId: conv.id,
            fromAgent: currentAssignedTo,
            toAgent: targetUserId,
            kommoUser: kommoUserRaw,
            reason: isKommoEra ? 'Kommo era — use Kommo responsible' : 'Post-Kommo reassignment',
          });
          agentUpdates++;
        }
      } else if (!isKommoEra && conv) {
        // Post-Kommo era: if agent is not in VALID_SELLER_IDS → reassign randomly
        if (currentAssignedTo && !VALID_SELLER_IDS.has(currentAssignedTo)) {
          const randomSeller = VALID_SELLER_LIST[Math.floor(Math.random() * VALID_SELLER_LIST.length)];
          actions.push({
            type: 'agent_reassign',
            convId: conv.id,
            fromAgent: currentAssignedTo,
            toAgent: randomSeller,
            reason: 'Post-Kommo agent has no active connection — random reassignment',
          });
          agentUpdates++;
        }
      }

      if (actions.length > 0) {
        totalActions += actions.length;
        report.push({
          funnel: config.name,
          leadId: lead.id,
          contactName: contact?.name,
          contactPhone: phone,
          source,
          isKommoEra,
          currentStageId,
          actions,
        });
      }
    }

    console.log(`  Stage updates planned: ${stageUpdates}`);
    console.log(`  Agent updates planned: ${agentUpdates}`);
    console.log(`  Orphan leads (not in Kommo/Form): ${orphans}`);
  }

  // Save report
  const reportPath = path.join('scratch', 'reconciliation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n\n✅ Analysis complete. Total planned actions: ${totalActions}`);
  console.log(`📄 Report saved to: ${reportPath}`);
  
  // Stage update summary
  const stageActions = report.flatMap(r => r.actions.filter((a: any) => a.type === 'stage_update'));
  const agentActions = report.flatMap(r => r.actions.filter((a: any) => a.type === 'agent_update' || a.type === 'agent_reassign'));
  console.log(`  → Stage corrections: ${stageActions.length}`);
  console.log(`  → Agent corrections: ${agentActions.length}`);

  process.exit(0);
}

main().catch(console.error);
