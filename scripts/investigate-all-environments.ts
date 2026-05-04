/**
 * INVESTIGAÇÃO COMPLETA: Todas as localizações possíveis de sessões WhatsApp
 * Verifica: Produção, Local, Desenvolvimento, Notebook, Nuvem, Replit, Backups, etc.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

interface InvestigationResult {
  location: string;
  type: 'database' | 'filesystem' | 'auth_state' | 'backup' | 'cache' | 'config';
  sessions: number;
  details: any;
  status: 'found' | 'not_found' | 'error';
}

const results: InvestigationResult[] = [];

async function investigateAllEnvironments() {
  console.log('=== 🔍 INVESTIGAÇÃO COMPLETA: TODAS AS LOCALIZAÇÕES ===');
  console.log('');
  console.log('Verificando: Produção, Local, Dev, Notebook, Nuvem, Replit, Backups...');
  console.log('');
  
  // ============================================
  // 1. BANCO DE DADOS ATUAL
  // ============================================
  console.log('1️⃣ BANCO DE DADOS ATUAL');
  console.log('   Conectando ao banco de dados...');
  
  try {
    const dbSessions = await db.query.connections.findMany({
      where: eq(connections.connectionType, 'baileys'),
    });
    
    const dbAuthStates = await db.query.baileysAuthState.findMany();
    
    const dbCompanies = await db.query.companies.findMany();
    
    results.push({
      location: 'Banco de Dados Atual',
      type: 'database',
      sessions: dbSessions.length,
      details: {
        sessions: dbSessions.map(s => ({
          id: s.id,
          name: s.config_name,
          status: s.status,
          phone: s.phone,
          company: s.companyId,
        })),
        authStates: dbAuthStates.length,
        companies: dbCompanies.length,
        connectionString: process.env.DATABASE_URL ? 'Configurado' : 'Não configurado',
      },
      status: 'found',
    });
    
    console.log(`   ✅ Sessões no banco: ${dbSessions.length}`);
    console.log(`   ✅ Auth states: ${dbAuthStates.length}`);
    console.log(`   ✅ Empresas: ${dbCompanies.length}`);
    
    if (dbSessions.length > 0) {
      console.log('   Sessões encontradas:');
      dbSessions.forEach(s => {
        console.log(`      - ${s.config_name} | ${s.status} | ${s.phone || 'N/A'}`);
      });
    }
  } catch (error: any) {
    results.push({
      location: 'Banco de Dados Atual',
      type: 'database',
      sessions: 0,
      details: { error: error.message },
      status: 'error',
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
  console.log('');
  
  // ============================================
  // 2. FILESYSTEM ATUAL
  // ============================================
  console.log('2️⃣ FILESYSTEM ATUAL');
  const currentSessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
  
  try {
    const items = await fs.readdir(currentSessionsPath, { withFileTypes: true });
    const sessionDirs = items.filter(item => item.isDirectory() && item.name.startsWith('session_'));
    
    const fsSessions: any[] = [];
    for (const dir of sessionDirs) {
      const dirPath = path.join(currentSessionsPath, dir.name);
      const files = await fs.readdir(dirPath, { recursive: true });
      
      let deviceId = null;
      try {
        const credsPath = path.join(dirPath, 'creds.json');
        const creds = JSON.parse(await fs.readFile(credsPath, 'utf-8'));
        deviceId = creds.me?.id;
      } catch {
        // creds.json não existe
      }
      
      fsSessions.push({
        folder: dir.name,
        connectionId: dir.name.replace('session_', ''),
        fileCount: files.length,
        deviceId,
      });
    }
    
    results.push({
      location: `Filesystem Atual (${currentSessionsPath})`,
      type: 'filesystem',
      sessions: sessionDirs.length,
      details: {
        path: currentSessionsPath,
        sessions: fsSessions,
      },
      status: 'found',
    });
    
    console.log(`   ✅ Pastas de sessão: ${sessionDirs.length}`);
    if (sessionDirs.length > 0) {
      console.log('   Primeiras 5 sessões:');
      fsSessions.slice(0, 5).forEach(s => {
        console.log(`      - ${s.folder} (${s.fileCount} arquivos)`);
      });
      if (fsSessions.length > 5) {
        console.log(`      ... e mais ${fsSessions.length - 5} sessões`);
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      results.push({
        location: `Filesystem Atual (${currentSessionsPath})`,
        type: 'filesystem',
        sessions: 0,
        details: { path: currentSessionsPath, exists: false },
        status: 'not_found',
      });
      console.log('   ✅ Pasta não existe (limpo)');
    } else {
      results.push({
        location: `Filesystem Atual (${currentSessionsPath})`,
        type: 'filesystem',
        sessions: 0,
        details: { error: error.message },
        status: 'error',
      });
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  console.log('');
  
  // ============================================
  // 3. VARIÁVEIS DE AMBIENTE
  // ============================================
  console.log('3️⃣ VARIÁVEIS DE AMBIENTE');
  const envVars: any = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? 'Configurado' : 'Não configurado',
    BAILEYS_SESSIONS_ENABLED: process.env.BAILEYS_SESSIONS_ENABLED,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CUSTOM_DOMAIN: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN,
    REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  };
  
  results.push({
    location: 'Variáveis de Ambiente',
    type: 'config',
    sessions: 0,
    details: envVars,
    status: 'found',
  });
  
  console.log('   Ambiente:', envVars.NODE_ENV || 'N/A');
  console.log('   BAILEYS_SESSIONS_ENABLED:', envVars.BAILEYS_SESSIONS_ENABLED || 'N/A');
  console.log('   NEXTAUTH_URL:', envVars.NEXTAUTH_URL || 'N/A');
  console.log('   Custom Domain:', envVars.NEXT_PUBLIC_CUSTOM_DOMAIN || 'N/A');
  console.log('');
  
  // ============================================
  // 4. LOCALIZAÇÕES ALTERNATIVAS DE FILESYSTEM
  // ============================================
  console.log('4️⃣ LOCALIZAÇÕES ALTERNATIVAS DE FILESYSTEM');
  const alternativePaths = [
    path.join(process.cwd(), '.wwebjs_auth'),
    path.join(process.cwd(), 'baileys_auth'),
    path.join(process.cwd(), 'auth_info_baileys'),
    path.join(process.cwd(), 'sessions'),
    path.join(process.cwd(), 'whatsapp_auth'),
    path.join(process.cwd(), 'tmp', 'whatsapp_sessions'),
    path.join(process.cwd(), 'storage', 'whatsapp_sessions'),
    path.join(process.cwd(), 'data', 'whatsapp_sessions'),
    path.join(process.cwd(), 'var', 'whatsapp_sessions'),
    path.join(process.cwd(), 'app', 'whatsapp_sessions'),
    // Home directory
    path.join(require('os').homedir(), '.whatsapp_sessions'),
    path.join(require('os').homedir(), '.baileys_auth'),
    // Temp directories
    path.join(require('os').tmpdir(), 'whatsapp_sessions'),
    path.join(require('os').tmpdir(), 'baileys_auth'),
  ];
  
  const foundAlternatives: any[] = [];
  for (const altPath of alternativePaths) {
    try {
      const items = await fs.readdir(altPath);
      if (items.length > 0) {
        foundAlternatives.push({
          path: altPath,
          items: items.length,
        });
        console.log(`   ⚠️  Encontrado: ${altPath} (${items.length} itens)`);
      }
    } catch {
      // Pasta não existe
    }
  }
  
  if (foundAlternatives.length === 0) {
    console.log('   ✅ Nenhuma localização alternativa encontrada');
  }
  
  results.push({
    location: 'Localizações Alternativas',
    type: 'filesystem',
    sessions: foundAlternatives.length,
    details: { paths: foundAlternatives },
    status: foundAlternatives.length > 0 ? 'found' : 'not_found',
  });
  console.log('');
  
  // ============================================
  // 5. BACKUPS E CACHES
  // ============================================
  console.log('5️⃣ BACKUPS E CACHES');
  const backupPaths = [
    path.join(process.cwd(), 'backups'),
    path.join(process.cwd(), '.backups'),
    path.join(process.cwd(), 'backup'),
    path.join(process.cwd(), 'whatsapp_sessions_backup'),
    path.join(process.cwd(), '.next', 'cache'),
    path.join(process.cwd(), 'node_modules', '.cache'),
  ];
  
  const foundBackups: any[] = [];
  for (const backupPath of backupPaths) {
    try {
      const items = await fs.readdir(backupPath);
      const sessionItems = items.filter(item => 
        item.includes('session') || item.includes('whatsapp') || item.includes('baileys')
      );
      if (sessionItems.length > 0) {
        foundBackups.push({
          path: backupPath,
          items: sessionItems,
        });
        console.log(`   ⚠️  Backup encontrado: ${backupPath}`);
        console.log(`      Itens relacionados: ${sessionItems.length}`);
      }
    } catch {
      // Pasta não existe
    }
  }
  
  if (foundBackups.length === 0) {
    console.log('   ✅ Nenhum backup de sessões encontrado');
  }
  
  results.push({
    location: 'Backups e Caches',
    type: 'backup',
    sessions: foundBackups.length,
    details: { backups: foundBackups },
    status: foundBackups.length > 0 ? 'found' : 'not_found',
  });
  console.log('');
  
  // ============================================
  // 6. VERIFICAR MÚLTIPLOS BANCOS (se houver)
  // ============================================
  console.log('6️⃣ VERIFICANDO MÚLTIPLOS BANCOS DE DADOS');
  
  const dbUrls: string[] = [];
  if (process.env.DATABASE_URL) {
    dbUrls.push(process.env.DATABASE_URL);
  }
  if (process.env.POSTGRES_URL) {
    dbUrls.push(process.env.POSTGRES_URL);
  }
  if (process.env.DB_URL) {
    dbUrls.push(process.env.DB_URL);
  }
  
  console.log(`   URLs de banco encontradas: ${dbUrls.length}`);
  dbUrls.forEach((url, idx) => {
    const masked = url.replace(/:[^:@]+@/, ':****@');
    console.log(`   [${idx + 1}] ${masked.substring(0, 50)}...`);
  });
  
  results.push({
    location: 'Múltiplos Bancos',
    type: 'database',
    sessions: 0,
    details: { dbUrls: dbUrls.length, urls: dbUrls.map(u => u.replace(/:[^:@]+@/, ':****@')) },
    status: dbUrls.length > 1 ? 'found' : 'not_found',
  });
  console.log('');
  
  // ============================================
  // 7. VERIFICAR CONFIGURAÇÕES DE DEPLOY
  // ============================================
  console.log('7️⃣ CONFIGURAÇÕES DE DEPLOY');
  
  const deployConfigs: any = {};
  
  // Verificar .replit
  try {
    const replitContent = await fs.readFile(path.join(process.cwd(), '.replit'), 'utf-8');
    const hasProduction = replitContent.includes('[userenv.production]');
    const hasDevelopment = replitContent.includes('[userenv.development]');
    deployConfigs.replit = {
      hasProduction,
      hasDevelopment,
    };
    console.log('   ✅ .replit encontrado');
    console.log(`      Produção: ${hasProduction ? 'Sim' : 'Não'}`);
    console.log(`      Desenvolvimento: ${hasDevelopment ? 'Sim' : 'Não'}`);
  } catch {
    console.log('   ⚠️  .replit não encontrado');
  }
  
  // Verificar docker-compose
  try {
    await fs.access(path.join(process.cwd(), 'docker-compose.yml'));
    deployConfigs.docker = true;
    console.log('   ✅ docker-compose.yml encontrado');
  } catch {
    deployConfigs.docker = false;
  }
  
  // Verificar vercel.json
  try {
    await fs.access(path.join(process.cwd(), 'vercel.json'));
    deployConfigs.vercel = true;
    console.log('   ✅ vercel.json encontrado');
  } catch {
    deployConfigs.vercel = false;
  }
  
  results.push({
    location: 'Configurações de Deploy',
    type: 'config',
    sessions: 0,
    details: deployConfigs,
    status: 'found',
  });
  console.log('');
  
  // ============================================
  // 8. VERIFICAR PROCESSOS RODANDO
  // ============================================
  console.log('8️⃣ PROCESSOS E INSTÂNCIAS');
  
  const processInfo = {
    platform: process.platform,
    nodeVersion: process.version,
    cwd: process.cwd(),
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
  };
  
  console.log('   Plataforma:', processInfo.platform);
  console.log('   Node.js:', processInfo.nodeVersion);
  console.log('   Diretório atual:', processInfo.cwd);
  console.log('   PID:', processInfo.pid);
  console.log('   Uptime:', processInfo.uptime, 'segundos');
  
  results.push({
    location: 'Processo Atual',
    type: 'config',
    sessions: 0,
    details: processInfo,
    status: 'found',
  });
  console.log('');
  
  // ============================================
  // 9. RESUMO FINAL
  // ============================================
  console.log('=== 📊 RESUMO FINAL DA INVESTIGAÇÃO ===');
  console.log('');
  
  const totalSessions = results.reduce((sum, r) => sum + r.sessions, 0);
  const foundLocations = results.filter(r => r.status === 'found' && r.sessions > 0);
  const errorLocations = results.filter(r => r.status === 'error');
  
  console.log(`Total de localizações verificadas: ${results.length}`);
  console.log(`Localizações com sessões: ${foundLocations.length}`);
  console.log(`Total de sessões encontradas: ${totalSessions}`);
  console.log(`Localizações com erro: ${errorLocations.length}`);
  console.log('');
  
  if (foundLocations.length > 0) {
    console.log('🔴 LOCALIZAÇÕES COM SESSÕES:');
    foundLocations.forEach(loc => {
      console.log(`   - ${loc.location}: ${loc.sessions} sessões`);
      if (loc.type === 'filesystem' && loc.details.sessions) {
        loc.details.sessions.slice(0, 3).forEach((s: any) => {
          console.log(`     • ${s.folder || s.connectionId} (${s.fileCount || 0} arquivos)`);
        });
        if (loc.details.sessions.length > 3) {
          console.log(`     ... e mais ${loc.details.sessions.length - 3} sessões`);
        }
      }
    });
    console.log('');
  }
  
  if (errorLocations.length > 0) {
    console.log('⚠️  LOCALIZAÇÕES COM ERRO:');
    errorLocations.forEach(loc => {
      console.log(`   - ${loc.location}: ${loc.details.error}`);
    });
    console.log('');
  }
  
  // ============================================
  // 10. RECOMENDAÇÕES
  // ============================================
  console.log('=== 💡 RECOMENDAÇÕES ===');
  console.log('');
  
  if (totalSessions > 0) {
    console.log('🔴 AÇÃO NECESSÁRIA:');
    console.log('   1. Limpar sessões órfãs no filesystem');
    console.log('   2. Verificar se há outros servidores rodando');
    console.log('   3. Limpar backups se houver sessões lá');
    console.log('   4. Aguardar sincronização do WhatsApp (5-10 min)');
    console.log('');
  } else {
    console.log('✅ TUDO LIMPO:');
    console.log('   Nenhuma sessão encontrada em nenhuma localização.');
    console.log('   Se o WhatsApp ainda mostra dispositivos, aguarde sincronização.');
    console.log('');
  }
  
  // Salvar relatório
  const reportPath = path.join(process.cwd(), 'investigation-report-all-environments.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Relatório salvo em: ${reportPath}`);
  console.log('');
  
  process.exit(0);
}

investigateAllEnvironments();
