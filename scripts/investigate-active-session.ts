/**
 * Script para investigar por que o WhatsApp ainda mostra sessão ativa
 */

import { db } from '../src/lib/db';
import { connections, baileysAuthState } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

const SESSIONS_PATH = path.join(process.cwd(), 'whatsapp_sessions');
const SESSION_ID = '9ee5f5b8-166a-4ba3-9293-f1af0700bb7b';

async function investigate() {
  console.log('=== 🔍 INVESTIGAÇÃO DETALHADA: SESSÃO ATIVA NO WHATSAPP ===');
  console.log('');
  
  // 1. Verificar banco de dados
  console.log('1️⃣ VERIFICANDO BANCO DE DADOS...');
  const sessionInDB = await db.query.connections.findFirst({
    where: eq(connections.id, SESSION_ID),
  });
  
  if (sessionInDB) {
    console.log('   ✅ Sessão encontrada no banco:');
    console.log('      ID:', sessionInDB.id);
    console.log('      Nome:', sessionInDB.config_name);
    console.log('      Status:', sessionInDB.status);
    console.log('      Telefone:', sessionInDB.phone);
    console.log('      Ativo:', sessionInDB.isActive);
    console.log('      Última conexão:', sessionInDB.lastConnected);
  } else {
    console.log('   ❌ Sessão NÃO encontrada no banco de dados');
  }
  console.log('');
  
  // 2. Verificar auth state no banco
  console.log('2️⃣ VERIFICANDO AUTH STATE NO BANCO...');
  const authStates = await db.query.baileysAuthState.findMany({
    where: eq(baileysAuthState.connectionId, SESSION_ID),
  });
  
  console.log('   Auth states encontrados:', authStates.length);
  if (authStates.length > 0) {
    console.log('   ⚠️ AINDA HÁ AUTH STATES NO BANCO!');
    authStates.forEach((auth, idx) => {
      console.log(`   [${idx + 1}] ID: ${auth.id}, Tamanho: ${JSON.stringify(auth.state).length} bytes`);
    });
  }
  console.log('');
  
  // 3. Verificar filesystem
  console.log('3️⃣ VERIFICANDO FILESYSTEM...');
  const sessionPath = path.join(SESSIONS_PATH, `session_${SESSION_ID}`);
  
  try {
    const files = await fs.readdir(sessionPath, { recursive: true });
    console.log('   ✅ Pasta de sessão existe!');
    console.log('   Caminho:', sessionPath);
    console.log('   Total de arquivos:', files.length);
    
    // Verificar arquivos importantes
    const importantFiles = [
      'creds.json',
      'app-state-sync-key-*.json',
      'pre-key-*.json',
      'session-*.json',
      'sender-key-*.json',
    ];
    
    console.log('');
    console.log('   Arquivos encontrados (primeiros 20):');
    files.slice(0, 20).forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file}`);
    });
    if (files.length > 20) {
      console.log(`   ... e mais ${files.length - 20} arquivos`);
    }
    
    // Verificar se creds.json existe
    const credsPath = path.join(sessionPath, 'creds.json');
    try {
      const creds = await fs.readFile(credsPath, 'utf-8');
      const credsData = JSON.parse(creds);
      console.log('');
      console.log('   📄 creds.json encontrado!');
      console.log('   Meu dispositivo ID:', credsData.me?.id);
      console.log('   Platform:', credsData.me?.platform);
      console.log('   Tamanho:', creds.length, 'bytes');
    } catch (e) {
      console.log('   ⚠️ creds.json não encontrado ou inválido');
    }
    
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log('   ✅ Pasta de sessão NÃO existe (já foi deletada)');
    } else {
      console.log('   ❌ Erro ao verificar pasta:', e.message);
    }
  }
  console.log('');
  
  // 4. Verificar todas as sessões no banco
  console.log('4️⃣ VERIFICANDO TODAS AS SESSÕES BAILEYS NO BANCO...');
  const allSessions = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  console.log('   Total de sessões Baileys:', allSessions.length);
  if (allSessions.length > 0) {
    allSessions.forEach((s, idx) => {
      console.log(`   [${idx + 1}] ${s.config_name} | ${s.status} | ${s.phone || 'N/A'} | Ativo: ${s.isActive}`);
    });
  } else {
    console.log('   ✅ Nenhuma sessão Baileys no banco');
  }
  console.log('');
  
  // 5. Verificar todas as pastas no filesystem
  console.log('5️⃣ VERIFICANDO TODAS AS PASTAS NO FILESYSTEM...');
  try {
    const allDirs = await fs.readdir(SESSIONS_PATH);
    const sessionDirs = allDirs.filter(dir => dir.startsWith('session_'));
    console.log('   Total de pastas de sessão:', sessionDirs.length);
    sessionDirs.forEach((dir, idx) => {
      console.log(`   [${idx + 1}] ${dir}`);
    });
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log('   ✅ Pasta whatsapp_sessions não existe');
    } else {
      console.log('   ❌ Erro:', e.message);
    }
  }
  console.log('');
  
  // 6. CONCLUSÃO
  console.log('=== 📊 CONCLUSÃO DA INVESTIGAÇÃO ===');
  console.log('');
  
  const hasDB = !!sessionInDB;
  const hasAuthState = authStates.length > 0;
  let hasFilesystem = false;
  try {
    await fs.access(sessionPath);
    hasFilesystem = true;
  } catch {
    hasFilesystem = false;
  }
  
  console.log('Estado atual:');
  console.log('  Banco de dados:', hasDB ? '✅ Existe' : '❌ Não existe');
  console.log('  Auth State (DB):', hasAuthState ? '⚠️ Existe' : '✅ Limpo');
  console.log('  Filesystem:', hasFilesystem ? '⚠️ Existe' : '✅ Limpo');
  console.log('');
  
  if (hasFilesystem && !hasDB) {
    console.log('🔴 PROBLEMA IDENTIFICADO:');
    console.log('   As credenciais ainda estão no filesystem, mas a sessão foi deletada do banco.');
    console.log('   O WhatsApp do celular ainda vê a sessão como ativa porque as credenciais existem.');
    console.log('');
    console.log('✅ SOLUÇÃO:');
    console.log('   Deletar a pasta do filesystem para desconectar completamente do WhatsApp.');
  } else if (hasFilesystem && hasDB) {
    console.log('⚠️ SESSÃO PARCIALMENTE LIMPA:');
    console.log('   A sessão existe no banco E no filesystem.');
    console.log('   Precisa desconectar via API do WhatsApp antes de deletar.');
  } else if (!hasFilesystem && hasDB) {
    console.log('⚠️ SESSÃO ÓRFÃ NO BANCO:');
    console.log('   A sessão existe no banco mas não tem credenciais.');
    console.log('   Pode ser deletada do banco com segurança.');
  } else {
    console.log('✅ TUDO LIMPO:');
    console.log('   Não há sessão no banco nem no filesystem.');
  }
  
  process.exit(0);
}

investigate();
