/**
 * Script para limpar sessões órfãs no filesystem
 * Remove credenciais que ainda existem no filesystem mas não no banco
 * Isso desconecta o WhatsApp do celular
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const SESSIONS_PATH = path.join(process.cwd(), 'whatsapp_sessions');

interface SessionInfo {
  connectionId: string;
  folderName: string;
  folderPath: string;
  fileCount: number;
  existsInDB: boolean;
  phone?: string | null;
}

async function cleanupOrphanSessions() {
  console.log('=== 🧹 LIMPEZA DE SESSÕES ÓRFÃS NO FILESYSTEM ===');
  console.log('');
  
  // 1. Listar todas as pastas de sessão no filesystem
  console.log('1️⃣ Verificando pastas de sessão no filesystem...');
  let sessionFolders: string[] = [];
  
  try {
    const allItems = await fs.readdir(SESSIONS_PATH);
    sessionFolders = allItems.filter(item => item.startsWith('session_'));
    console.log(`   Encontradas ${sessionFolders.length} pastas de sessão`);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log('   ✅ Pasta whatsapp_sessions não existe (já está limpa)');
      process.exit(0);
    } else {
      console.error('   ❌ Erro ao ler pasta:', e.message);
      process.exit(1);
    }
  }
  
  if (sessionFolders.length === 0) {
    console.log('   ✅ Nenhuma pasta de sessão encontrada');
    process.exit(0);
  }
  
  console.log('');
  
  // 2. Verificar quais existem no banco
  console.log('2️⃣ Verificando quais sessões existem no banco de dados...');
  const allSessionsInDB = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  const sessionIdsInDB = new Set(allSessionsInDB.map(s => s.id));
  console.log(`   Sessões no banco: ${allSessionsInDB.length}`);
  allSessionsInDB.forEach(s => {
    console.log(`     - ${s.id.substring(0, 8)}... | ${s.config_name} | ${s.status}`);
  });
  console.log('');
  
  // 3. Analisar cada pasta
  console.log('3️⃣ Analisando cada pasta de sessão...');
  const sessionInfos: SessionInfo[] = [];
  
  for (const folderName of sessionFolders) {
    const connectionId = folderName.replace('session_', '');
    const folderPath = path.join(SESSIONS_PATH, folderName);
    
    try {
      const files = await fs.readdir(folderPath, { recursive: true });
      const existsInDB = sessionIdsInDB.has(connectionId);
      
      // Buscar telefone no banco se existir
      const sessionInDB = allSessionsInDB.find(s => s.id === connectionId);
      
      sessionInfos.push({
        connectionId,
        folderName,
        folderPath,
        fileCount: files.length,
        existsInDB,
        phone: sessionInDB?.phone || null,
      });
      
      console.log(`   [${sessionInfos.length}] ${folderName}`);
      console.log(`       ID: ${connectionId.substring(0, 8)}...`);
      console.log(`       Arquivos: ${files.length}`);
      console.log(`       No banco: ${existsInDB ? '✅ Sim' : '❌ Não (ÓRFÃ)'}`);
      if (sessionInDB) {
        console.log(`       Telefone: ${sessionInDB.phone || 'N/A'}`);
        console.log(`       Status: ${sessionInDB.status}`);
      }
      console.log('');
    } catch (e: any) {
      console.error(`   ❌ Erro ao analisar ${folderName}:`, e.message);
    }
  }
  
  // 4. Identificar órfãs
  const orphanSessions = sessionInfos.filter(s => !s.existsInDB);
  
  console.log('4️⃣ RESUMO:');
  console.log(`   Total de pastas: ${sessionInfos.length}`);
  console.log(`   Sessões no banco: ${sessionInfos.filter(s => s.existsInDB).length}`);
  console.log(`   Sessões órfãs (sem banco): ${orphanSessions.length}`);
  console.log('');
  
  if (orphanSessions.length === 0) {
    console.log('✅ Nenhuma sessão órfã encontrada!');
    process.exit(0);
  }
  
  // 5. Mostrar órfãs
  console.log('5️⃣ SESSÕES ÓRFÃS ENCONTRADAS (serão deletadas):');
  orphanSessions.forEach((session, idx) => {
    console.log(`   [${idx + 1}] ${session.folderName}`);
    console.log(`       ID: ${session.connectionId}`);
    console.log(`       Arquivos: ${session.fileCount}`);
    console.log(`       Telefone: ${session.phone || 'N/A'}`);
    console.log('');
  });
  
  // 6. Confirmar e deletar
  console.log('6️⃣ DELETANDO SESSÕES ÓRFÃS...');
  console.log('');
  
  let deleted = 0;
  let errors = 0;
  
  for (const session of orphanSessions) {
    try {
      console.log(`   🗑️  Deletando ${session.folderName}...`);
      await fs.rm(session.folderPath, { recursive: true, force: true });
      console.log(`   ✅ Deletada com sucesso (${session.fileCount} arquivos removidos)`);
      deleted++;
    } catch (e: any) {
      console.error(`   ❌ Erro ao deletar ${session.folderName}:`, e.message);
      errors++;
    }
  }
  
  console.log('');
  console.log('=== ✅ LIMPEZA CONCLUÍDA ===');
  console.log(`   Deletadas: ${deleted}`);
  console.log(`   Erros: ${errors}`);
  console.log('');
  
  if (deleted > 0) {
    console.log('🎯 RESULTADO:');
    console.log('   As credenciais foram removidas do filesystem.');
    console.log('   O WhatsApp do celular deve desconectar automaticamente.');
    console.log('   Aguarde alguns segundos e verifique no celular.');
  }
  
  process.exit(0);
}

cleanupOrphanSessions();
