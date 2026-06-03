import 'dotenv/config';
import { db } from '../src/lib/db';
import { companies, kanbanBoards } from '../src/lib/db/schema';
import type { UtmRoutingRule } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  // Pegar primeira empresa (MasterIA)
  const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies).limit(5);
  console.log('\n🏢 Empresas encontradas:');
  allCompanies.forEach(c => console.log(`  ${c.id} → ${c.name}`));

  // Pegar todos os boards
  const allBoards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
    .from(kanbanBoards);

  console.log('\n📂 Funis disponíveis:');
  allBoards.forEach(b => {
    const stages = (b.stages as any[]) || [];
    const stageNames = stages.map((s: any) => s.title).join(', ');
    console.log(`  ${b.id} → ${b.name}`);
    console.log(`     Etapas: [${stageNames}]`);
  });

  // Mostrar quais têm "EDN" no nome para diagnosticar o bug
  const ednBoards = allBoards.filter(b => b.name.toUpperCase().includes('EDN'));
  console.log(`\n⚠️  Boards com "EDN" no nome: ${ednBoards.length}`);
  ednBoards.forEach(b => console.log(`  - ${b.name} (${b.id})`));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
