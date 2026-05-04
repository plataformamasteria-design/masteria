/**
 * Verifica sessões em memória e cache Redis
 * Identifica sessões que podem estar ativas mesmo após limpeza
 */

import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { redis } from '../src/lib/redis';

async function checkMemorySessions() {
  console.log('=== 🔍 VERIFICAÇÃO DE SESSÕES EM MEMÓRIA E CACHE ===');
  console.log('');
  
  // 1. Verificar banco de dados
  console.log('1️⃣ BANCO DE DADOS');
  const dbSessions = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  console.log(`   Sessões no banco: ${dbSessions.length}`);
  if (dbSessions.length > 0) {
    dbSessions.forEach(s => {
      console.log(`      - ${s.config_name} | ${s.status} | ${s.phone || 'N/A'}`);
    });
  }
  console.log('');
  
  // 2. Verificar filesystem
  console.log('2️⃣ FILESYSTEM');
  const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
  let sessionDirs: any[] = [];
  try {
    const items = await fs.readdir(sessionsPath, { withFileTypes: true });
    sessionDirs = items.filter(item => item.isDirectory() && item.name.startsWith('session_'));
    console.log(`   Pastas de sessão: ${sessionDirs.length}`);
    if (sessionDirs.length > 0) {
      sessionDirs.forEach(dir => {
        console.log(`      - ${dir.name}`);
      });
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('   ✅ Pasta não existe (limpo)');
    } else {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  console.log('');
  
  // 3. Verificar cache Redis
  console.log('3️⃣ CACHE REDIS');
  let keys: string[] = [];
  try {
    keys = await redis.keys('whatsapp:sessions:*');
    console.log(`   Chaves de cache: ${keys.length}`);
    if (keys.length > 0) {
      console.log('   Chaves encontradas:');
      keys.forEach(key => {
        console.log(`      - ${key}`);
      });
      
      // Limpar cache
      console.log('');
      console.log('   🧹 Limpando cache Redis...');
      for (const key of keys) {
        await redis.del(key);
      }
      console.log('   ✅ Cache limpo');
    } else {
      console.log('   ✅ Nenhum cache encontrado');
    }
  } catch (error: any) {
    console.log(`   ⚠️  Erro ao verificar Redis: ${error.message}`);
  }
  console.log('');
  
  // 4. Verificar sessões ativas via health endpoint (se possível)
  console.log('4️⃣ SESSÕES EM MEMÓRIA (RUNTIME)');
  console.log('   ⚠️  Nota: Sessões em memória só podem ser verificadas');
  console.log('      quando o servidor está rodando e o BaileysSessionManager');
  console.log('      está ativo. Para limpar sessões em memória:');
  console.log('      1. Reinicie o servidor no Replit');
  console.log('      2. Ou aguarde o timeout natural das sessões');
  console.log('');
  
  // 5. Resumo
  console.log('=== 📊 RESUMO ===');
  console.log('');
  console.log(`Banco de dados: ${dbSessions.length} sessões`);
  console.log(`Filesystem: ${sessionDirs.length} pastas`);
  console.log(`Cache Redis: ${keys.length} chaves`);
  console.log('');
  
  if (dbSessions.length === 0 && (sessionDirs?.length || 0) === 0 && (keys?.length || 0) === 0) {
    console.log('✅ TUDO LIMPO:');
    console.log('   Nenhuma sessão encontrada em banco, filesystem ou cache.');
    console.log('   Se o WhatsApp ainda mostra dispositivos:');
    console.log('   1. Aguarde 10-20 minutos (sincronização)');
    console.log('   2. Reinicie o servidor no Replit (limpa memória)');
    console.log('   3. Remova manualmente no celular');
  } else {
    console.log('⚠️  SESSÕES ENCONTRADAS:');
    if (dbSessions.length > 0) {
      console.log(`   - Banco: ${dbSessions.length} sessões`);
    }
    if ((sessionDirs?.length || 0) > 0) {
      console.log(`   - Filesystem: ${sessionDirs.length} pastas`);
    }
    if ((keys?.length || 0) > 0) {
      console.log(`   - Cache: ${keys.length} chaves (já limpo)`);
    }
  }
  
  console.log('');
  process.exit(0);
}

checkMemorySessions();
