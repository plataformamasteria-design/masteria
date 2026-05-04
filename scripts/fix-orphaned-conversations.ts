
import { db } from '../src/lib/db';
import { connections, conversations, companies } from '../src/lib/db/schema';
import { eq, isNull, and, count } from 'drizzle-orm';
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
  console.log('║  REPARADOR DE CONVERSAS ÓRFÃS (PÓS-LIMPEZA)                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Identificar empresas com conversas órfãs
  console.log('🔍 Analisando conversas órfãs por empresa...');
  
  const allCompanies = await db.select().from(companies);
  
  for (const company of allCompanies) {
    // Contar conversas órfãs
    const [orphanedCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(and(
        eq(conversations.companyId, company.id),
        isNull(conversations.connectionId)
      ));

    if (orphanedCount.count === 0) continue;

    console.log(`\n🏢 Empresa: ${company.name} (ID: ${company.id})`);
    console.log(`   ⚠️  Conversas Órfãs (sem conexão): ${orphanedCount.count}`);

    // Buscar conexões ativas
    const activeConnections = await db
      .select()
      .from(connections)
      .where(eq(connections.companyId, company.id));

    if (activeConnections.length === 0) {
      console.log(`   ❌ Nenhuma conexão encontrada. Reconecte o WhatsApp primeiro.`);
      continue;
    }

    console.log(`   ✅ Conexões Disponíveis: ${activeConnections.length}`);
    activeConnections.forEach((conn, idx) => {
      console.log(`      [${idx + 1}] ${conn.config_name} (Status: ${conn.status}) - ID: ${conn.id}`);
    });

    // Lógica de Correção
    if (activeConnections.length === 1) {
      const targetConn = activeConnections[0];
      console.log(`\n   💡 Sugestão: Vincular todas as ${orphanedCount.count} conversas à conexão única "${targetConn.config_name}"?`);
      
      const answer = await question('      Executar correção? (s/n): ');
      if (answer.toLowerCase() === 's') {
        await linkConversations(company.id, targetConn.id);
      }
    } else {
      console.log(`\n   🤔 Múltiplas conexões detectadas. Qual conexão deve assumir as conversas antigas?`);
      const answer = await question('      Digite o número da conexão (ou 0 para pular): ');
      const selection = parseInt(answer);
      
      if (selection > 0 && selection <= activeConnections.length) {
        const targetConn = activeConnections[selection - 1];
        await linkConversations(company.id, targetConn.id);
      } else {
        console.log('      Pulado.');
      }
    }
  }

  console.log('\n✅ Processo finalizado.');
  rl.close();
  process.exit(0);
}

async function linkConversations(companyId: string, connectionId: string) {
  console.log(`      ⏳ Vinculando conversas...`);
  
  const result = await db.update(conversations)
    .set({ connectionId: connectionId })
    .where(and(
      eq(conversations.companyId, companyId),
      isNull(conversations.connectionId)
    ));
    
  console.log(`      ✅ Sucesso! Conversas recuperadas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
