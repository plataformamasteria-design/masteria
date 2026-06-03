/**
 * Script: seed-utm-rules.ts
 * Semeia as regras corretas de UTM routing para a empresa MasterIA.
 * Identifica a empresa pelo board FUNIL EVENTO GCR.
 */
import 'dotenv/config';
import { db } from '../src/lib/db';
import { companies, kanbanBoards } from '../src/lib/db/schema';
import type { UtmRoutingRule } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

// IDs confirmados via list-boards.ts
const GCR_BOARD_ID     = 'b7f872be-03db-4e3a-832c-f7c746aa14cc'; // FUNIL EVENTO GCR
const EDN_BOARD_ID     = 'b8856169-d5ee-40ea-a876-20c8b46234cf'; // FUNIL EDN [ATUAL]  (2293 leads - principal)
const MENTORIA_BOARD   = '6bccc06c-4eb2-41e1-9c9d-5a133c267418'; // FUNIL MENTORIA
const CASAIS_BOARD     = '72e90627-1f9c-493e-a243-71ef668c021a'; // FUNIL ENCONTRO DE CASAIS

async function main() {
  // Descobrir companyId pelo board GCR
  const [gcrBoard] = await db
    .select({ companyId: kanbanBoards.companyId })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.id, GCR_BOARD_ID));

  if (!gcrBoard) { console.error('❌ Board GCR não encontrado'); process.exit(1); }
  const companyId = gcrBoard.companyId;
  console.log(`\n✅ Empresa identificada: ${companyId}`);

  // Buscar nomes dos boards destino para label
  const boards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name })
    .from(kanbanBoards)
    .where(inArray(kanbanBoards.id, [GCR_BOARD_ID, EDN_BOARD_ID, MENTORIA_BOARD, CASAIS_BOARD]));
  const boardName = (id: string) => boards.find(b => b.id === id)?.name ?? id;

  const rules: UtmRoutingRule[] = [
    {
      id: 'rule-gcr',
      label: 'GCR — Evento GCR',
      pattern: 'EVENTO-GCR|EVENTO GCR|\\bGCR\\b',
      isRegex: true,
      targetBoardId: GCR_BOARD_ID,
      targetBoardName: boardName(GCR_BOARD_ID),
      isActive: true,
    },
    {
      id: 'rule-edn',
      label: 'EDN — Encontro de Negócios',
      pattern: 'ENCONTRO DE NEG',
      isRegex: false,
      targetBoardId: EDN_BOARD_ID,
      targetBoardName: boardName(EDN_BOARD_ID),
      isActive: true,
    },
    {
      id: 'rule-mentoria',
      label: 'MENTORIA',
      pattern: 'MENTORIA',
      isRegex: false,
      targetBoardId: MENTORIA_BOARD,
      targetBoardName: boardName(MENTORIA_BOARD),
      isActive: true,
    },
    {
      id: 'rule-casais',
      label: 'Encontro de Casais / Casal de Negócios',
      pattern: 'CASAL DE NEG|EVENTO-CASAL|ENCONTRO DE CASAIS',
      isRegex: false,
      targetBoardId: CASAIS_BOARD,
      targetBoardName: boardName(CASAIS_BOARD),
      isActive: true,
    },
  ];

  console.log('\n📋 Regras a serem salvas:');
  rules.forEach(r => console.log(`  [${r.isActive ? '✓' : '✗'}] "${r.label}" → ${r.targetBoardName} | pattern: "${r.pattern}"`));

  await db
    .update(companies)
    .set({ utmRoutingRules: rules, updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  console.log('\n✅ Regras salvas com sucesso na empresa!');
  console.log('\n💡 Abra o Diagnóstico UTM no Kanban para verificar os resultados.');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
