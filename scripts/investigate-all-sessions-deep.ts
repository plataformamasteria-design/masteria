/**
 * Investigação profunda de TODAS as sessões WhatsApp
 * Verifica filesystem, banco de dados, e possíveis localizações alternativas
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const SESSIONS_PATH = path.join(process.cwd(), 'whatsapp_sessions');

interface SessionLocation {
  type: 'filesystem' | 'database' | 'auth_state';
  connectionId?: string;
  path?: string;
  name?: string;
  phone?: string | null;
  status?: string;
  fileCount?: number;
  details?: any;
}

async function deepInvestigation() {
  console.log('=== 🔍 INVESTIGAÇÃO PROFUNDA: TODAS AS SESSÕES ===');
  console.log('');
  
  const allSessions: SessionLocation[] = [];
  
  // 1. Verificar TODAS as pastas no filesystem (incluindo subpastas)
  console.log('1️⃣ Verificando filesystem (todas as pastas)...');
  try {
    const allItems = await fs.readdir(SESSIONS_PATH, { withFileTypes: true });
    
    for (const item of allItems) {
      if (item.isDirectory()) {
        const folderPath = path.join(SESSIONS_PATH, item.name);
        const connectionId = item.name.replace('session_', '');
        
        try {
          const files = await fs.readdir(folderPath, { recursive: true });
          
          // Tentar ler creds.json se existir
          let credsInfo: any = null;
          try {
            const credsPath = path.join(folderPath, 'creds.json');
            const credsContent = await fs.readFile(credsPath, 'utf-8');
            credsInfo = JSON.parse(credsContent);
          } catch {
            // creds.json não existe ou é inválido
          }
          
          allSessions.push({
            type: 'filesystem',
            connectionId,
            path: folderPath,
            fileCount: files.length,
            details: {
              folderName: item.name,
              hasCreds: !!credsInfo,
              deviceId: credsInfo?.me?.id || null,
              platform: credsInfo?.me?.platform || null,
            }
          });
          
          console.log(`   📁 ${item.name}`);
          console.log(`      Arquivos: ${files.length}`);
          if (credsInfo) {
            console.log(`      Device ID: ${credsInfo.me?.id || 'N/A'}`);
            console.log(`      Platform: ${credsInfo.me?.platform || 'N/A'}`);
          }
        } catch (e: any) {
          console.error(`   ❌ Erro ao ler ${item.name}:`, e.message);
        }
      }
    }
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log('   ✅ Pasta whatsapp_sessions não existe');
    } else {
      console.error('   ❌ Erro:', e.message);
    }
  }
  console.log('');
  
  // 2. Verificar TODAS as sessões no banco de dados
  console.log('2️⃣ Verificando banco de dados...');
  const dbSessions = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  dbSessions.forEach(session => {
    allSessions.push({
      type: 'database',
      connectionId: session.id,
      name: session.config_name,
      phone: session.phone,
      status: session.status,
      details: {
        isActive: session.isActive,
        lastConnected: session.lastConnected,
        environment: session.environment,
      }
    });
    
    console.log(`   💾 ${session.config_name} (${session.id.substring(0, 8)}...)`);
    console.log(`      Status: ${session.status}`);
    console.log(`      Telefone: ${session.phone || 'N/A'}`);
    console.log(`      Ativo: ${session.isActive}`);
  });
  
  if (dbSessions.length === 0) {
    console.log('   ✅ Nenhuma sessão no banco');
  }
  console.log('');
  
  // 3. Verificar TODOS os auth states
  console.log('3️⃣ Verificando auth states no banco...');
  const allAuthStates = await db.query.baileysAuthState.findMany();
  
  const authStateConnections = new Set<string>();
  allAuthStates.forEach(auth => {
    authStateConnections.add(auth.connectionId);
    allSessions.push({
      type: 'auth_state',
      connectionId: auth.connectionId,
      details: {
        authId: auth.id,
        stateSize: JSON.stringify(auth.state).length,
      }
    });
  });
  
  console.log(`   Auth states encontrados: ${allAuthStates.length}`);
  if (allAuthStates.length > 0) {
    console.log(`   Connection IDs únicos: ${authStateConnections.size}`);
    Array.from(authStateConnections).forEach(id => {
      console.log(`      - ${id.substring(0, 8)}...`);
    });
  } else {
    console.log('   ✅ Nenhum auth state no banco');
  }
  console.log('');
  
  // 4. Análise cruzada
  console.log('4️⃣ ANÁLISE CRUZADA:');
  console.log('');
  
  const fsConnectionIds = new Set(
    allSessions.filter(s => s.type === 'filesystem').map(s => s.connectionId!)
  );
  const dbConnectionIds = new Set(
    allSessions.filter(s => s.type === 'database').map(s => s.connectionId!)
  );
  const authConnectionIds = new Set(
    allSessions.filter(s => s.type === 'auth_state').map(s => s.connectionId!)
  );
  
  // Sessões apenas no filesystem (órfãs)
  const orphanFS = Array.from(fsConnectionIds).filter(id => !dbConnectionIds.has(id));
  console.log(`   Sessões apenas no filesystem (órfãs): ${orphanFS.length}`);
  orphanFS.forEach(id => {
    const session = allSessions.find(s => s.type === 'filesystem' && s.connectionId === id);
    console.log(`      - ${id.substring(0, 8)}... (${session?.fileCount} arquivos)`);
  });
  console.log('');
  
  // Sessões apenas no banco (sem filesystem)
  const orphanDB = Array.from(dbConnectionIds).filter(id => !fsConnectionIds.has(id));
  console.log(`   Sessões apenas no banco (sem filesystem): ${orphanDB.length}`);
  orphanDB.forEach(id => {
    const session = allSessions.find(s => s.type === 'database' && s.connectionId === id);
    console.log(`      - ${session?.name} (${id.substring(0, 8)}...)`);
  });
  console.log('');
  
  // Sessões completas (filesystem + banco)
  const complete = Array.from(fsConnectionIds).filter(id => dbConnectionIds.has(id));
  console.log(`   Sessões completas (filesystem + banco): ${complete.length}`);
  complete.forEach(id => {
    const fsSession = allSessions.find(s => s.type === 'filesystem' && s.connectionId === id);
    const dbSession = allSessions.find(s => s.type === 'database' && s.connectionId === id);
    console.log(`      - ${dbSession?.name} (${id.substring(0, 8)}...)`);
    console.log(`        Status: ${dbSession?.status}`);
    console.log(`        Telefone: ${dbSession?.phone || 'N/A'}`);
    console.log(`        Arquivos: ${fsSession?.fileCount}`);
  });
  console.log('');
  
  // 5. Verificar possíveis localizações alternativas
  console.log('5️⃣ Verificando localizações alternativas...');
  
  // Verificar se há pastas com nomes diferentes
  const possiblePaths = [
    path.join(process.cwd(), '.wwebjs_auth'),
    path.join(process.cwd(), 'baileys_auth'),
    path.join(process.cwd(), 'auth_info_baileys'),
    path.join(process.cwd(), 'sessions'),
  ];
  
  for (const possiblePath of possiblePaths) {
    try {
      const items = await fs.readdir(possiblePath);
      if (items.length > 0) {
        console.log(`   ⚠️ Pasta alternativa encontrada: ${possiblePath}`);
        console.log(`      Itens: ${items.length}`);
      }
    } catch {
      // Pasta não existe
    }
  }
  console.log('');
  
  // 6. RESUMO FINAL
  console.log('=== 📊 RESUMO FINAL ===');
  console.log('');
  console.log(`Total de sessões encontradas: ${allSessions.length}`);
  console.log(`  - Filesystem: ${allSessions.filter(s => s.type === 'filesystem').length}`);
  console.log(`  - Banco de dados: ${allSessions.filter(s => s.type === 'database').length}`);
  console.log(`  - Auth states: ${allSessions.filter(s => s.type === 'auth_state').length}`);
  console.log('');
  console.log(`Sessões órfãs no filesystem: ${orphanFS.length}`);
  console.log(`Sessões órfãs no banco: ${orphanDB.length}`);
  console.log(`Sessões completas: ${complete.length}`);
  console.log('');
  
  if (orphanFS.length > 0) {
    console.log('🔴 AÇÃO NECESSÁRIA:');
    console.log('   Há sessões órfãs no filesystem que precisam ser deletadas.');
    console.log('   Execute: npx tsx scripts/cleanup-orphan-session-filesystem.ts');
  }
  
  if (complete.length > 0) {
    console.log('⚠️ ATENÇÃO:');
    console.log('   Há sessões completas (filesystem + banco) que podem estar ativas.');
    console.log('   Verifique se essas sessões devem ser mantidas ou deletadas.');
  }
  
  process.exit(0);
}

deepInvestigation();
