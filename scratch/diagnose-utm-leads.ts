/**
 * Script: diagnose-utm-leads.ts
 * Uso: npx tsx scratch/diagnose-utm-leads.ts [--dry-run] [--migrate]
 *
 * - --dry-run  (padrão): apenas lista leads fora do funil correto. Não altera nada.
 * - --migrate : executa a migração (somente após revisar o dry-run).
 */
import 'dotenv/config';
import { db } from '../src/lib/db';
import { kanbanLeads, contacts, kanbanBoards } from '../src/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ─── Configuração da Empresa ─────────────────────────────────────────────────
// Encontrado via auditoria no browser (organização: MasterIA)
const COMPANY_ID_MASTERIA = 'auto'; // 'auto' = busca todos os boards e detecta

// ─── Mapeamento UTM → Funil ───────────────────────────────────────────────────
// Regras baseadas na auditoria de campo realizada em 2026-06-02
const UTM_FUNNEL_RULES: { pattern: RegExp; funnelKeyword: string; description: string }[] = [
  {
    pattern: /evento[- ]?gcr|\bGCR\b/i,
    funnelKeyword: 'GCR',
    description: 'FUNIL EVENTO GCR',
  },
  {
    pattern: /encontro de neg[oó]cios/i,
    funnelKeyword: 'EDN',
    description: 'FUNIL EDN [ATUAL]',
  },
  {
    pattern: /mentoria/i,
    funnelKeyword: 'MENTORIA',
    description: 'FUNIL MENTORIA',
  },
  {
    pattern: /casal[- ]?de[- ]?neg[oó]cios|encontro de casais/i,
    funnelKeyword: 'CASAIS',
    description: 'FUNIL ENCONTRO DE CASAIS',
  },
];

// ─── Mapeamento de Funis conhecidos (IDs da organização MasterIA) ─────────────
const KNOWN_FUNNELS: Record<string, { name: string; id: string; firstStageId?: string }> = {
  GCR: {
    name: 'FUNIL EVENTO GCR',
    id: 'b7f872be-03db-4e3a-832c-f7c746aa14cc',
  },
  EDN: {
    name: 'FUNIL EDN [ATUAL]',
    id: 'b8856169-d5ee-40ea-a876-20c8b46234cf',
  },
  MENTORIA: {
    name: 'FUNIL MENTORIA',
    id: '6bccc06c-4eb2-41e1-9c9d-5a133c267418',
  },
  CASAIS: {
    name: 'FUNIL ENCONTRO DE CASAIS',
    id: '72e90627-1f9c-493e-a243-71ef668c021a',
  },
};

// ─── Utilitários ─────────────────────────────────────────────────────────────
function extractUtmCampaign(customFields: any): string | null {
  if (!customFields || typeof customFields !== 'object') return null;
  const key = Object.keys(customFields).find(
    k =>
      k.toLowerCase().includes('utm_campaign') ||
      k.toLowerCase().includes('utm campaing') ||
      k.toLowerCase().includes('utm campaign')
  );
  return key ? String(customFields[key]).trim() : null;
}

function detectFunnelFromUtm(utm: string): string | null {
  for (const rule of UTM_FUNNEL_RULES) {
    if (rule.pattern.test(utm)) {
      return rule.funnelKeyword;
    }
  }
  return null;
}

function getCurrentFunnelKeyword(boardId: string): string | null {
  for (const [key, funnel] of Object.entries(KNOWN_FUNNELS)) {
    if (funnel.id === boardId) return key;
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--migrate');
  const migrate = args.includes('--migrate');
  const targetBoardArg = args.find(a => a.startsWith('--board='))?.split('=')[1];

  console.log('\n========================================================');
  console.log('  🔍 MasterIA — Diagnóstico UTM Campaign vs Funil');
  console.log(`  Modo: ${isDryRun ? '🔒 DRY-RUN (sem alterações)' : '🚀 MIGRAÇÃO'}`);
  console.log('========================================================\n');

  // Determinar quais boards analisar
  const boardIds = targetBoardArg
    ? [targetBoardArg]
    : Object.values(KNOWN_FUNNELS).map(f => f.id);

  console.log(`📋 Analisando ${boardIds.length} funil(is)...\n`);

  const allMismatches: {
    leadId: string;
    contactName: string;
    utmCampaign: string;
    currentFunnelKey: string;
    currentFunnelName: string;
    correctFunnelKey: string;
    correctFunnelName: string;
    currentBoardId: string;
    correctBoardId: string;
  }[] = [];

  for (const boardId of boardIds) {
    const currentFunnelKey = getCurrentFunnelKeyword(boardId);
    const funnelName = currentFunnelKey ? KNOWN_FUNNELS[currentFunnelKey]?.name : boardId;

    console.log(`\n📂 Analisando: ${funnelName} (${boardId})`);

    // Buscar todos os leads do board com customFields do contato
    const leadsRaw = await db
      .select({
        leadId: kanbanLeads.id,
        contactId: kanbanLeads.contactId,
        boardId: kanbanLeads.boardId,
        stageId: kanbanLeads.stageId,
        contactName: contacts.name,
        customFields: contacts.customFields,
      })
      .from(kanbanLeads)
      .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
      .where(eq(kanbanLeads.boardId, boardId));

    let totalWithUtm = 0;
    let mismatchCount = 0;

    for (const row of leadsRaw) {
      let cf = row.customFields;
      if (typeof cf === 'string') {
        try { cf = JSON.parse(cf); } catch { cf = {}; }
      }

      const utm = extractUtmCampaign(cf as any);
      if (!utm) continue;

      totalWithUtm++;
      const detectedKey = detectFunnelFromUtm(utm);

      if (detectedKey && detectedKey !== currentFunnelKey) {
        mismatchCount++;
        const correctFunnel = KNOWN_FUNNELS[detectedKey];
        allMismatches.push({
          leadId: row.leadId,
          contactName: row.contactName || '(sem nome)',
          utmCampaign: utm,
          currentFunnelKey: currentFunnelKey || 'DESCONHECIDO',
          currentFunnelName: funnelName || boardId,
          correctFunnelKey: detectedKey,
          correctFunnelName: correctFunnel?.name || detectedKey,
          currentBoardId: boardId,
          correctBoardId: correctFunnel?.id || '',
        });
      }
    }

    console.log(`   ✅ Leads com UTM: ${totalWithUtm}`);
    console.log(`   ⚠️  Leads fora do lugar: ${mismatchCount}`);
  }

  // ─── Relatório Final ────────────────────────────────────────────────────────
  console.log('\n\n========================================================');
  console.log(`  📊 RELATÓRIO FINAL — ${allMismatches.length} lead(s) fora do funil correto`);
  console.log('========================================================\n');

  if (allMismatches.length === 0) {
    console.log('🎉 Todos os leads estão no funil correto!');
    process.exit(0);
  }

  // Agrupar por par (funil atual → funil correto)
  const byMigration = new Map<string, typeof allMismatches>();
  for (const m of allMismatches) {
    const key = `${m.currentFunnelKey}→${m.correctFunnelKey}`;
    if (!byMigration.has(key)) byMigration.set(key, []);
    byMigration.get(key)!.push(m);
  }

  for (const [key, items] of byMigration.entries()) {
    const first = items[0];
    console.log(`\n  🔄 ${first.currentFunnelName} → ${first.correctFunnelName} (${items.length} leads)`);
    console.log('  ─────────────────────────────────────────────────────');
    for (const item of items.slice(0, 20)) {
      console.log(`    • ${item.contactName.padEnd(30)} | UTM: ${item.utmCampaign.substring(0, 60)}`);
    }
    if (items.length > 20) {
      console.log(`    ... e mais ${items.length - 20} leads`);
    }
  }

  // ─── Migração ───────────────────────────────────────────────────────────────
  if (migrate && allMismatches.length > 0) {
    console.log('\n\n========================================================');
    console.log('  🚀 EXECUTANDO MIGRAÇÃO...');
    console.log('========================================================\n');

    // Agrupar por par de migração para eficiência
    for (const [key, items] of byMigration.entries()) {
      const first = items[0];
      if (!first.correctBoardId) {
        console.warn(`  ⚠️  Funil destino desconhecido para ${key} — pulando...`);
        continue;
      }

      // Determinar a primeira etapa do funil destino
      const destBoard = await db
        .select({ stages: kanbanBoards.stages })
        .from(kanbanBoards)
        .where(eq(kanbanBoards.id, first.correctBoardId))
        .limit(1);

      const stages = destBoard[0]?.stages as any[];
      const firstStage = stages?.find(s => s.type !== 'LOSS') || stages?.[0];
      if (!firstStage) {
        console.error(`  ❌ Não foi possível encontrar etapa inicial para ${first.correctFunnelName}`);
        continue;
      }

      const leadIds = items.map(i => i.leadId);
      console.log(`  ↪ Movendo ${leadIds.length} leads: ${first.currentFunnelName} → ${first.correctFunnelName}`);
      console.log(`    Etapa destino: "${firstStage.title}" (${firstStage.id})`);

      // UPDATE em lote
      await db
        .update(kanbanLeads)
        .set({
          boardId: first.correctBoardId,
          stageId: firstStage.id,
        })
        .where(inArray(kanbanLeads.id, leadIds));

      console.log(`  ✅ ${leadIds.length} leads movidos com sucesso!`);
    }

    console.log('\n🎉 Migração concluída!');
  } else if (!migrate) {
    console.log('\n\n💡 Para executar a migração, rode:');
    console.log('   npx tsx scratch/diagnose-utm-leads.ts --migrate\n');
  }
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
