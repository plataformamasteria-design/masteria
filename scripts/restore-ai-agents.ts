
import { db } from '../src/lib/db';
import { connections, aiPersonas, companies } from '../src/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  RESTAURADOR DE AGENTES DE IA (PÓS-LIMPEZA)                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Buscar todas as empresas
  const allCompanies = await db.select().from(companies);
  console.log(`🔍 Analisando ${allCompanies.length} empresas...`);

  for (const company of allCompanies) {
    // Buscar Personas da empresa
    const personas = await db
      .select()
      .from(aiPersonas)
      .where(eq(aiPersonas.companyId, company.id));

    if (personas.length === 0) continue;

    // Buscar conexões ativas
    const activeConnections = await db
      .select()
      .from(connections)
      .where(eq(connections.companyId, company.id));

    if (activeConnections.length === 0) continue;

    console.log(`\n🏢 Empresa: ${company.name}`);
    console.log(`   🤖 Personas encontradas: ${personas.length}`);
    console.log(`   📱 Conexões ativas: ${activeConnections.length}`);

    // Verificar conexões SEM persona atribuída
    const unassignedConnections = activeConnections.filter(c => !c.assignedPersonaId);

    if (unassignedConnections.length > 0) {
      console.log(`   ⚠️  ${unassignedConnections.length} conexões sem Agente de IA vinculado.`);
      
      // Se tiver apenas 1 persona e conexões sem persona, sugerir vínculo automático
      if (personas.length === 1) {
        const targetPersona = personas[0];
        console.log(`   💡 Sugestão: Vincular persona "${targetPersona.name}" às conexões desvinculadas?`);
        
        const answer = await question('      Executar vínculo? (s/n): ');
        if (answer.toLowerCase() === 's') {
          for (const conn of unassignedConnections) {
            await db.update(connections)
              .set({ assignedPersonaId: targetPersona.id })
              .where(eq(connections.id, conn.id));
            console.log(`      ✅ Conexão "${conn.config_name}" vinculada a "${targetPersona.name}"`);
          }
        }
      } else {
        // Múltiplas personas: listar e perguntar
        console.log('   🤔 Múltiplas personas disponíveis. Escolha qual vincular:');
        personas.forEach((p, idx) => {
          console.log(`      [${idx + 1}] ${p.name} (Model: ${p.model})`);
        });
        console.log(`      [0] Pular`);

        for (const conn of unassignedConnections) {
          const answer = await question(`      Vincular conexão "${conn.config_name}" a qual persona? (0-${personas.length}): `);
          const selection = parseInt(answer);
          
          if (selection > 0 && selection <= personas.length) {
            const targetPersona = personas[selection - 1];
            await db.update(connections)
              .set({ assignedPersonaId: targetPersona.id })
              .where(eq(connections.id, conn.id));
            console.log(`      ✅ Vinculado com sucesso.`);
          } else {
            console.log('      Pulado.');
          }
        }
      }
    } else {
      console.log('   ✅ Todas as conexões já possuem Agente de IA vinculado.');
    }
  }

  console.log('\n✅ Processo finalizado.');
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
