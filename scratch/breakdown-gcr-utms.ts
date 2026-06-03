/**
 * Script: breakdown-gcr-utms.ts
 * Detalha os 441 leads do FUNIL EVENTO GCR por categoria de utm_campaign
 */
import 'dotenv/config';
import { db } from '../src/lib/db';
import { kanbanLeads, contacts } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const GCR_BOARD_ID = 'b7f872be-03db-4e3a-832c-f7c746aa14cc';

function extractUtmCampaign(customFields: any): string | null {
  if (!customFields || typeof customFields !== 'object') return null;
  const key = Object.keys(customFields).find(k =>
    k.toLowerCase().includes('utm_campaign') ||
    k.toLowerCase().includes('utm campaing') ||
    k.toLowerCase().includes('utm campaign')
  );
  return key ? String(customFields[key]).trim() : null;
}

async function main() {
  console.log('\n==========================================================');
  console.log('  🔬 FUNIL EVENTO GCR — Breakdown por UTM Campaign');
  console.log('==========================================================\n');

  const leads = await db
    .select({
      leadId: kanbanLeads.id,
      contactName: contacts.name,
      customFields: contacts.customFields,
    })
    .from(kanbanLeads)
    .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
    .where(eq(kanbanLeads.boardId, GCR_BOARD_ID));

  console.log(`📋 Total de leads no funil: ${leads.length}\n`);

  // Categorias
  const semUtm: string[] = [];
  const comUtmGCR: string[] = [];
  const comUtmOutros: { name: string; utm: string }[] = [];

  for (const row of leads) {
    let cf = row.customFields;
    if (typeof cf === 'string') {
      try { cf = JSON.parse(cf); } catch { cf = {}; }
    }

    const utm = extractUtmCampaign(cf as any);

    if (!utm) {
      semUtm.push(row.contactName || '(sem nome)');
      continue;
    }

    const isGCR = /evento[- ]?gcr|\bGCR\b/i.test(utm);
    if (isGCR) {
      comUtmGCR.push(row.contactName || '(sem nome)');
    } else {
      comUtmOutros.push({ name: row.contactName || '(sem nome)', utm });
    }
  }

  // Breakdown por keyword dos "outros"
  const outrosPorKeyword = new Map<string, { name: string; utm: string }[]>();
  for (const item of comUtmOutros) {
    let keyword = '❓ Outros / Não mapeado';
    if (/encontro de neg[oó]cios/i.test(item.utm))   keyword = '🔵 EDN — Encontro de Negócios';
    if (/mentoria/i.test(item.utm))                   keyword = '🟣 MENTORIA';
    if (/casal[- ]?de[- ]?neg[oó]cios|encontro de casais/i.test(item.utm)) keyword = '🩷 CASAIS';

    if (!outrosPorKeyword.has(keyword)) outrosPorKeyword.set(keyword, []);
    outrosPorKeyword.get(keyword)!.push(item);
  }

  // ─── Relatório ────────────────────────────────────────────────────────────
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log(`│  ✅ COM UTM GCR (corretos):          ${String(comUtmGCR.length).padStart(4)} leads           │`);
  console.log(`│  ⚠️  COM UTM de OUTRO funil:          ${String(comUtmOutros.length).padStart(4)} leads           │`);
  console.log(`│  ❌ SEM UTM Campaign:                 ${String(semUtm.length).padStart(4)} leads           │`);
  console.log(`│  ─────────────────────────────────────────────────────  │`);
  console.log(`│  TOTAL:                               ${String(leads.length).padStart(4)} leads           │`);
  console.log('└─────────────────────────────────────────────────────────┘\n');

  console.log('─── UTMs de outros funis encontradas no GCR ─────────────');
  for (const [keyword, items] of outrosPorKeyword.entries()) {
    console.log(`\n  ${keyword} (${items.length} leads):`);
    for (const item of items) {
      console.log(`    • ${item.name.padEnd(30)} | ${item.utm.substring(0, 70)}`);
    }
  }

  console.log('\n\n─── Leads SEM UTM Campaign (amostra dos primeiros 20) ───');
  semUtm.slice(0, 20).forEach(name => console.log(`    • ${name}`));
  if (semUtm.length > 20) console.log(`    ... e mais ${semUtm.length - 20} leads sem UTM`);

  console.log(`\n\n💡 Conclusão:`);
  console.log(`   • ${comUtmGCR.length} leads estão corretos (UTM GCR)`);
  console.log(`   • ${comUtmOutros.length} leads têm UTM de outro funil e podem ser realocados`);
  console.log(`   • ${semUtm.length} leads não têm UTM Campaign (${((semUtm.length / leads.length) * 100).toFixed(1)}% do total)`);
  console.log(`     → Esses leads podem ter vindo de outras fontes (importação manual, Kommo, etc.)\n`);
}

main().catch(err => {
  console.error('\n❌ Erro:', err);
  process.exit(1);
});
