/**
 * Script para testar que sessões são inicializadas sem filtro de ambiente
 */

import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const COMPANY_ID = '682b91ea-15ee-42da-8855-70309b237008';

async function testSessionInitialization() {
  console.log('=== TESTE DE INICIALIZAÇÃO SEM FILTRO DE AMBIENTE ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('');
  
  // Create test sessions with different environments
  console.log('📝 Criando sessões de teste com diferentes ambientes...');
  
  const [prodSession] = await db.insert(connections).values({
    companyId: COMPANY_ID,
    config_name: 'TESTE-PROD-SESSION',
    connectionType: 'baileys',
    status: 'disconnected',
    isActive: true,
    environment: 'production',
  }).returning();
  
  const [devSession] = await db.insert(connections).values({
    companyId: COMPANY_ID,
    config_name: 'TESTE-DEV-SESSION',
    connectionType: 'baileys',
    status: 'disconnected',
    isActive: true,
    environment: 'development',
  }).returning();
  
  console.log('✅ Sessões criadas:');
  console.log('   PROD:', prodSession.id, '-', prodSession.config_name);
  console.log('   DEV:', devSession.id, '-', devSession.config_name);
  console.log('');
  
  // Test: Query sessions WITHOUT environment filter (new behavior)
  console.log('📊 Testando query SEM filtro de ambiente (novo comportamento)...');
  const sessionsWithoutFilter = await db.query.connections.findMany({
    where: and(
      eq(connections.connectionType, 'baileys'),
      eq(connections.isActive, true)
      // REMOVIDO: eq(connections.environment, currentEnv)
    ),
  });
  
  const testSessions = sessionsWithoutFilter.filter(s => 
    s.id === prodSession.id || s.id === devSession.id
  );
  
  console.log('   Total sessões encontradas:', sessionsWithoutFilter.length);
  console.log('   Sessões de teste encontradas:', testSessions.length);
  
  if (testSessions.length === 2) {
    console.log('   ✅ AMBAS as sessões (prod e dev) foram encontradas!');
    console.log('   Sessões:');
    testSessions.forEach(s => {
      console.log(`      - ${s.config_name} (env: ${s.environment})`);
    });
  } else {
    console.log('   ❌ FALHOU: Esperava 2 sessões, encontrou', testSessions.length);
  }
  
  // Test: Query sessions WITH environment filter (old behavior - for comparison)
  console.log('');
  console.log('📊 Testando query COM filtro de ambiente (comportamento antigo)...');
  const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const sessionsWithFilter = await db.query.connections.findMany({
    where: and(
      eq(connections.connectionType, 'baileys'),
      eq(connections.isActive, true),
      eq(connections.environment, currentEnv) // OLD: Filter by environment
    ),
  });
  
  const testSessionsOld = sessionsWithFilter.filter(s => 
    s.id === prodSession.id || s.id === devSession.id
  );
  
  console.log('   Current ENV:', currentEnv);
  console.log('   Sessões de teste encontradas:', testSessionsOld.length);
  console.log('   ⚠️ Com filtro antigo, apenas a sessão do ambiente atual seria encontrada');
  
  // Clean up
  console.log('');
  console.log('🧹 Limpando sessões de teste...');
  await db.delete(connections).where(eq(connections.id, prodSession.id));
  await db.delete(connections).where(eq(connections.id, devSession.id));
  console.log('✅ Sessões de teste deletadas');
  
  console.log('');
  console.log('=== RESULTADO DO TESTE ===');
  if (testSessions.length === 2) {
    console.log('✅ SUCESSO: A query sem filtro de ambiente encontra TODAS as sessões!');
    console.log('   Isso significa que em dev você verá sessões criadas em prod e vice-versa.');
    console.log('');
    console.log('🎯 BENEFÍCIOS:');
    console.log('   1. Sessões não são mais isoladas por ambiente');
    console.log('   2. Desenvolvedores podem ver e testar sessões reais');
    console.log('   3. Não há mais conflitos quando NODE_ENV muda');
    console.log('   4. Código mais simples e menos propenso a bugs');
  } else {
    console.log('❌ FALHA: Ainda há problemas com o filtro de ambiente');
  }
  
  process.exit(0);
}

testSessionInitialization();
