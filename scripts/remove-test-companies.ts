/**
 * REMOÇÃO COMPLETA: Empresas de Teste
 * Remove todas as empresas de teste e TODOS os dados relacionados
 */

import { db } from '../src/lib/db';
import { 
  companies, 
  connections, 
  baileysAuthState,
  messages,
  conversations,
  contacts,
  campaigns,
  contactLists,
  tags,
  aiPersonas,
  kanbanBoards,
  users,
  // Adicionar outras tabelas relacionadas conforme necessário
} from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_COMPANIES = [
  "Test User's Company",
  "gemini_verifier's Company",
  "Teste Usuario's Company",
  "Gemini Verifier's Company",
  "gemini_verifierddf's Company",
  "Rogerio Nishimuta Proença's Company",
  "Dalton Andrade Marcos's Company",
];

async function removeTestCompanies() {
  console.log('=== 🗑️ REMOÇÃO COMPLETA: EMPRESAS DE TESTE ===');
  console.log('');
  console.log('⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL!');
  console.log('');
  
  // 1. Listar empresas de teste
  console.log('1️⃣ IDENTIFICANDO EMPRESAS DE TESTE');
  const allCompanies = await db.query.companies.findMany({
    columns: {
      id: true,
      name: true,
    },
  });
  
  const testCompanies = allCompanies.filter(c => 
    TEST_COMPANIES.includes(c.name || '')
  );
  
  console.log(`   Empresas de teste encontradas: ${testCompanies.length}`);
  testCompanies.forEach((c, idx) => {
    console.log(`   [${idx + 1}] ${c.name} (ID: ${c.id})`);
  });
  
  if (testCompanies.length === 0) {
    console.log('   ✅ Nenhuma empresa de teste encontrada.');
    process.exit(0);
  }
  
  const testCompanyIds = testCompanies.map(c => c.id);
  console.log('');
  
  // 2. Verificar dados relacionados
  console.log('2️⃣ VERIFICANDO DADOS RELACIONADOS');
  
  const connectionsCount = await db.query.connections.findMany({
    where: inArray(connections.companyId, testCompanyIds),
  });
  
  const messagesCount = await db.query.messages.findMany({
    where: inArray(messages.companyId, testCompanyIds),
  });
  
  const conversationsCount = await db.query.conversations.findMany({
    where: inArray(conversations.companyId, testCompanyIds),
  });
  
  const contactsCount = await db.query.contacts.findMany({
    where: inArray(contacts.companyId, testCompanyIds),
  });
  
  const campaignsCount = await db.query.campaigns.findMany({
    where: inArray(campaigns.companyId, testCompanyIds),
  });
  
  console.log(`   Conexões: ${connectionsCount.length}`);
  console.log(`   Mensagens: ${messagesCount.length}`);
  console.log(`   Conversas: ${conversationsCount.length}`);
  console.log(`   Contatos: ${contactsCount.length}`);
  console.log(`   Campanhas: ${campaignsCount.length}`);
  console.log('');
  
  // 3. Remover sessões WhatsApp do filesystem
  console.log('3️⃣ REMOVENDO SESSÕES WHATSAPP DO FILESYSTEM');
  const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
  let removedSessions = 0;
  
  try {
    const items = await fs.readdir(sessionsPath, { withFileTypes: true });
    const sessionDirs = items.filter(item => item.isDirectory() && item.name.startsWith('session_'));
    
    for (const dir of sessionDirs) {
      const connectionId = dir.name.replace('session_', '');
      
      // Verificar se esta conexão pertence a uma empresa de teste
      const connection = await db.query.connections.findFirst({
        where: eq(connections.id, connectionId),
      });
      
      if (connection && testCompanyIds.includes(connection.companyId)) {
        const dirPath = path.join(sessionsPath, dir.name);
        try {
          await fs.rm(dirPath, { recursive: true, force: true });
          removedSessions++;
          console.log(`   ✅ Removida: ${dir.name}`);
        } catch (error: any) {
          console.log(`   ⚠️  Erro ao remover ${dir.name}: ${error.message}`);
        }
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.log(`   ⚠️  Erro ao acessar filesystem: ${error.message}`);
    }
  }
  
  console.log(`   Total de sessões removidas: ${removedSessions}`);
  console.log('');
  
  // 4. Remover dados do banco (em ordem de dependência)
  console.log('4️⃣ REMOVENDO DADOS DO BANCO DE DADOS');
  console.log('   (Ordem: Dependências primeiro, depois empresas)');
  console.log('');
  
  try {
    // 4.1. Auth States
    console.log('   🗑️  Removendo auth states...');
    await db.delete(baileysAuthState)
      .where(inArray(baileysAuthState.companyId, testCompanyIds));
    console.log('   ✅ Auth states removidos');
    
    // 4.2. Connections
    console.log('   🗑️  Removendo conexões...');
    await db.delete(connections)
      .where(inArray(connections.companyId, testCompanyIds));
    console.log('   ✅ Conexões removidas');
    
    // 4.3. Messages
    console.log('   🗑️  Removendo mensagens...');
    await db.delete(messages)
      .where(inArray(messages.companyId, testCompanyIds));
    console.log('   ✅ Mensagens removidas');
    
    // 4.4. Conversations
    console.log('   🗑️  Removendo conversas...');
    await db.delete(conversations)
      .where(inArray(conversations.companyId, testCompanyIds));
    console.log('   ✅ Conversas removidas');
    
    // 4.5. Contacts
    console.log('   🗑️  Removendo contatos...');
    await db.delete(contacts)
      .where(inArray(contacts.companyId, testCompanyIds));
    console.log('   ✅ Contatos removidos');
    
    // 4.6. Campaigns
    console.log('   🗑️  Removendo campanhas...');
    await db.delete(campaigns)
      .where(inArray(campaigns.companyId, testCompanyIds));
    console.log('   ✅ Campanhas removidas');
    
    // 4.7. Contact Lists (se existir)
    try {
      console.log('   🗑️  Removendo listas de contatos...');
      await db.delete(contactLists)
        .where(inArray(contactLists.companyId, testCompanyIds));
      console.log('   ✅ Listas de contatos removidas');
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao remover listas: ${error.message}`);
    }
    
    // 4.8. Tags (se existir)
    try {
      console.log('   🗑️  Removendo tags...');
      await db.delete(tags)
        .where(inArray(tags.companyId, testCompanyIds));
      console.log('   ✅ Tags removidas');
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao remover tags: ${error.message}`);
    }
    
    // 4.9. AI Personas (se existir)
    try {
      console.log('   🗑️  Removendo personas de IA...');
      await db.delete(aiPersonas)
        .where(inArray(aiPersonas.companyId, testCompanyIds));
      console.log('   ✅ Personas removidas');
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao remover personas: ${error.message}`);
    }
    
    // 4.10. Kanban Boards (se existir)
    try {
      console.log('   🗑️  Removendo quadros Kanban...');
      await db.delete(kanbanBoards)
        .where(inArray(kanbanBoards.companyId, testCompanyIds));
      console.log('   ✅ Quadros removidos');
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao remover quadros: ${error.message}`);
    }
    
    // 4.11. Users (usuários associados às empresas de teste)
    console.log('   🗑️  Removendo usuários das empresas de teste...');
    const usersToDelete = await db.query.users.findMany({
      where: inArray(users.companyId, testCompanyIds),
    });
    
    if (usersToDelete.length > 0) {
      const userIds = usersToDelete.map(u => u.id);
      await db.delete(users)
        .where(inArray(users.id, userIds));
      console.log(`   ✅ ${usersToDelete.length} usuários removidos`);
    } else {
      console.log('   ✅ Nenhum usuário encontrado');
    }
    
    // 4.12. Companies (por último)
    console.log('   🗑️  Removendo empresas...');
    await db.delete(companies)
      .where(inArray(companies.id, testCompanyIds));
    console.log('   ✅ Empresas removidas');
    
  } catch (error: any) {
    console.log(`   ❌ Erro ao remover dados: ${error.message}`);
    console.log('   ⚠️  Operação pode ter sido parcialmente executada');
    throw error;
  }
  
  console.log('');
  
  // 5. Verificação final
  console.log('5️⃣ VERIFICAÇÃO FINAL');
  const remainingCompanies = await db.query.companies.findMany({
    where: inArray(companies.id, testCompanyIds),
  });
  
  if (remainingCompanies.length === 0) {
    console.log('   ✅ Todas as empresas de teste foram removidas');
  } else {
    console.log(`   ⚠️  ${remainingCompanies.length} empresas ainda existem`);
    remainingCompanies.forEach(c => {
      console.log(`      - ${c.name} (${c.id})`);
    });
  }
  
  console.log('');
  
  // 6. Resumo
  console.log('=== 📊 RESUMO ===');
  console.log('');
  console.log(`Empresas removidas: ${testCompanies.length}`);
  console.log(`Sessões WhatsApp removidas: ${removedSessions}`);
  console.log(`Conexões removidas: ${connectionsCount.length}`);
  console.log(`Mensagens removidas: ${messagesCount.length}`);
  console.log(`Conversas removidas: ${conversationsCount.length}`);
  console.log(`Contatos removidos: ${contactsCount.length}`);
  console.log(`Campanhas removidas: ${campaignsCount.length}`);
  console.log('');
  
  console.log('=== ✅ REMOÇÃO CONCLUÍDA ===');
  console.log('');
  console.log('Todas as empresas de teste e seus dados foram removidos.');
  console.log('');
  
  process.exit(0);
}

removeTestCompanies();
