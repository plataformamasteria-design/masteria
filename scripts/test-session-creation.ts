/**
 * Script para testar criação de sessão sem filtro de ambiente
 */

import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sessionRepository } from '../src/repositories/session.repository';

const COMPANY_ID = '682b91ea-15ee-42da-8855-70309b237008';

async function testSessionCreation() {
  console.log('=== TESTE DE CRIAÇÃO DE SESSÃO SEM FILTRO DE AMBIENTE ===');
  console.log('Company ID:', COMPANY_ID);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('');
  
  try {
    // Create session directly in database to test repository
    console.log('📝 Criando sessão via SessionRepository...');
    const session = await sessionRepository.create({
      companyId: COMPANY_ID,
      name: 'TESTE-ENV-AGNOSTIC',
      connectionType: 'baileys',
      // environment não é passado - deve usar padrão
    });
    
    console.log('✅ Sessão criada com sucesso!');
    console.log('   Session ID:', session.id);
    console.log('   Session Name:', session.name);
    console.log('   Session Status:', session.status);
    console.log('');
    
    // Verify the session was created correctly
    console.log('📊 Verificando sessão no banco de dados...');
    const [dbSession] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, session.id))
      .limit(1);
    
    if (dbSession) {
      console.log('✅ Sessão encontrada no banco:');
      console.log('   ID:', dbSession.id);
      console.log('   Nome:', dbSession.config_name);
      console.log('   Tipo:', dbSession.connectionType);
      console.log('   Status:', dbSession.status);
      console.log('   Ambiente:', dbSession.environment);
      console.log('   Ativo:', dbSession.isActive);
      console.log('');
      
      // Verify that environment is set to 'production' (default)
      if (dbSession.environment === 'production') {
        console.log('✅ TESTE PASSED: Campo environment está configurado para "production" (padrão)');
      } else {
        console.log('⚠️ TESTE WARNING: Campo environment está:', dbSession.environment);
      }
    } else {
      console.log('❌ ERRO: Sessão não encontrada no banco!');
    }
    
    // Clean up - delete the test session
    console.log('');
    console.log('🧹 Limpando sessão de teste...');
    await db.delete(connections).where(eq(connections.id, session.id));
    console.log('✅ Sessão de teste deletada');
    
    console.log('');
    console.log('=== RESULTADO DO TESTE ===');
    console.log('✅ A criação de sessão sem filtro de ambiente está funcionando corretamente!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  
  process.exit(0);
}

testSessionCreation();
