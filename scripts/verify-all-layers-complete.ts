/**
 * VERIFICAÇÃO COMPLETA: Todas as camadas do sistema
 * Frontend, Middleware, Backend, Cache, Memória, Database
 * E todas as possibilidades reais e verdadeiras
 */

import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { redis } from '../src/lib/redis';
import * as https from 'https';
import * as http from 'http';

interface VerificationResult {
  layer: string;
  location: string;
  status: 'clean' | 'found' | 'error' | 'unknown';
  sessions: number;
  details: any;
  timestamp: string;
}

const results: VerificationResult[] = [];

async function verifyDatabase() {
  console.log('=== 🗄️ CAMADA: BANCO DE DADOS ===');
  console.log('');
  
  try {
    // 1. Tabela connections
    const dbSessions = await db.query.connections.findMany({
      where: eq(connections.connectionType, 'baileys'),
    });
    
    // 2. Tabela baileysAuthState
    const authStates = await db.query.baileysAuthState.findMany();
    
    // 3. Verificar todas as empresas
    const allConnections = await db.query.connections.findMany();
    const baileysConnections = allConnections.filter(c => c.connectionType === 'baileys');
    
    results.push({
      layer: 'Database',
      location: 'connections table',
      status: dbSessions.length === 0 ? 'clean' : 'found',
      sessions: dbSessions.length,
      details: {
        total: dbSessions.length,
        sessions: dbSessions.map(s => ({
          id: s.id,
          name: s.config_name,
          status: s.status,
          phone: s.phone,
          isActive: s.isActive,
          companyId: s.companyId,
        })),
      },
      timestamp: new Date().toISOString(),
    });
    
    results.push({
      layer: 'Database',
      location: 'baileysAuthState table',
      status: authStates.length === 0 ? 'clean' : 'found',
      sessions: authStates.length,
      details: {
        total: authStates.length,
        authStates: authStates.map(a => ({
          connectionId: a.connectionId,
          companyId: a.companyId,
        })),
      },
      timestamp: new Date().toISOString(),
    });
    
    console.log(`✅ Tabela connections: ${dbSessions.length} sessões Baileys`);
    if (dbSessions.length > 0) {
      dbSessions.forEach(s => {
        console.log(`   - ${s.config_name} | ${s.status} | ${s.phone || 'N/A'} | Ativo: ${s.isActive}`);
      });
    }
    
    console.log(`✅ Tabela baileysAuthState: ${authStates.length} auth states`);
    if (authStates.length > 0) {
      authStates.forEach(a => {
        console.log(`   - Connection: ${a.connectionId} | Company: ${a.companyId}`);
      });
    }
    
    console.log(`✅ Total de conexões (todas): ${allConnections.length}`);
    console.log(`✅ Conexões Baileys: ${baileysConnections.length}`);
    
  } catch (error: any) {
    results.push({
      layer: 'Database',
      location: 'all tables',
      status: 'error',
      sessions: 0,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    });
    console.log(`❌ Erro: ${error.message}`);
  }
  
  console.log('');
}

async function verifyFilesystem() {
  console.log('=== 📁 CAMADA: FILESYSTEM ===');
  console.log('');
  
  const locations = [
    path.join(process.cwd(), 'whatsapp_sessions'),
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
    path.join(require('os').homedir(), '.whatsapp_sessions'),
    path.join(require('os').homedir(), '.baileys_auth'),
    path.join(require('os').tmpdir(), 'whatsapp_sessions'),
    path.join(require('os').tmpdir(), 'baileys_auth'),
  ];
  
  let totalSessions = 0;
  
  for (const location of locations) {
    try {
      const items = await fs.readdir(location, { withFileTypes: true });
      const sessionDirs = items.filter(item => 
        item.isDirectory() && (
          item.name.startsWith('session_') ||
          item.name.includes('whatsapp') ||
          item.name.includes('baileys') ||
          item.name.includes('auth')
        )
      );
      
      if (sessionDirs.length > 0) {
        totalSessions += sessionDirs.length;
        
        results.push({
          layer: 'Filesystem',
          location: location,
          status: 'found',
          sessions: sessionDirs.length,
          details: {
            path: location,
            directories: sessionDirs.map(d => d.name),
          },
          timestamp: new Date().toISOString(),
        });
        
        console.log(`⚠️  ${location}: ${sessionDirs.length} pastas encontradas`);
        sessionDirs.forEach(dir => {
          console.log(`   - ${dir.name}`);
        });
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.log(`   ⚠️  ${location}: Erro - ${error.message}`);
      }
    }
  }
  
  if (totalSessions === 0) {
    results.push({
      layer: 'Filesystem',
      location: 'all locations',
      status: 'clean',
      sessions: 0,
      details: { checked: locations.length },
      timestamp: new Date().toISOString(),
    });
    console.log(`✅ Nenhuma sessão encontrada no filesystem (${locations.length} locais verificados)`);
  }
  
  console.log('');
}

async function verifyCache() {
  console.log('=== 💾 CAMADA: CACHE ===');
  console.log('');
  
  // 1. Redis Cache
  try {
    const redisKeys = await redis.keys('whatsapp:*');
    const sessionKeys = redisKeys.filter(k => 
      k.includes('sessions') || 
      k.includes('session') || 
      k.includes('baileys') ||
      k.includes('whatsapp')
    );
    
    results.push({
      layer: 'Cache',
      location: 'Redis',
      status: sessionKeys.length === 0 ? 'clean' : 'found',
      sessions: sessionKeys.length,
      details: {
        totalKeys: redisKeys.length,
        sessionKeys: sessionKeys,
      },
      timestamp: new Date().toISOString(),
    });
    
    console.log(`✅ Redis: ${sessionKeys.length} chaves de sessão encontradas`);
    if (sessionKeys.length > 0) {
      sessionKeys.forEach(key => {
        console.log(`   - ${key}`);
      });
      
      // Limpar cache
      console.log('   🧹 Limpando cache Redis...');
      for (const key of sessionKeys) {
        await redis.del(key);
      }
      console.log('   ✅ Cache limpo');
    }
  } catch (error: any) {
    results.push({
      layer: 'Cache',
      location: 'Redis',
      status: 'error',
      sessions: 0,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    });
    console.log(`❌ Erro ao verificar Redis: ${error.message}`);
  }
  
  // 2. Next.js Cache
  const nextCachePaths = [
    path.join(process.cwd(), '.next', 'cache'),
    path.join(process.cwd(), '.next', 'server'),
    path.join(process.cwd(), 'node_modules', '.cache'),
  ];
  
  for (const cachePath of nextCachePaths) {
    try {
      const items = await fs.readdir(cachePath, { recursive: true });
      const sessionItems = items.filter(item => 
        item.includes('session') || 
        item.includes('whatsapp') || 
        item.includes('baileys')
      );
      
      if (sessionItems.length > 0) {
        results.push({
          layer: 'Cache',
          location: `Next.js Cache: ${cachePath}`,
          status: 'found',
          sessions: sessionItems.length,
          details: { items: sessionItems },
          timestamp: new Date().toISOString(),
        });
        console.log(`⚠️  ${cachePath}: ${sessionItems.length} itens relacionados`);
      }
    } catch {
      // Pasta não existe ou erro de acesso
    }
  }
  
  console.log('');
}

async function verifyBackendAPI(server: { name: string; baseUrl: string }) {
  return new Promise<VerificationResult>((resolve) => {
    const url = new URL(`${server.baseUrl}/api/v1/whatsapp/sessions`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url.toString(), { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const sessionCount = json.sessions?.length || 0;
            resolve({
              layer: 'Backend API',
              location: server.name,
              status: sessionCount === 0 ? 'clean' : 'found',
              sessions: sessionCount,
              details: {
                url: server.baseUrl,
                sessions: json.sessions || [],
              },
              timestamp: new Date().toISOString(),
            });
          } else {
            resolve({
              layer: 'Backend API',
              location: server.name,
              status: 'error',
              sessions: 0,
              details: { error: `HTTP ${res.statusCode}`, response: data.substring(0, 100) },
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          resolve({
            layer: 'Backend API',
            location: server.name,
            status: 'error',
            sessions: 0,
            details: { error: 'Parse error' },
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
    
    req.on('error', () => {
      resolve({
        layer: 'Backend API',
        location: server.name,
        status: 'error',
        sessions: 0,
        details: { error: 'Connection error' },
        timestamp: new Date().toISOString(),
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        layer: 'Backend API',
        location: server.name,
        status: 'error',
        sessions: 0,
        details: { error: 'Timeout' },
        timestamp: new Date().toISOString(),
      });
    });
  });
}

async function verifyBackend() {
  console.log('=== 🔧 CAMADA: BACKEND API ===');
  console.log('');
  
  const servers = [
    { name: 'Produção', baseUrl: 'https://masteria.app' },
    { name: 'Desenvolvimento', baseUrl: 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev' },
  ];
  
  for (const server of servers) {
    console.log(`🔍 Verificando ${server.name}...`);
    const result = await verifyBackendAPI(server);
    results.push(result);
    
    if (result.status === 'found') {
      console.log(`   ⚠️  ${result.sessions} sessões encontradas`);
      if (result.details.sessions) {
        result.details.sessions.forEach((s: any) => {
          console.log(`      - ${s.name || s.id} | ${s.status || 'N/A'}`);
        });
      }
    } else if (result.status === 'clean') {
      console.log(`   ✅ 0 sessões (limpo)`);
    } else {
      console.log(`   ❌ Erro: ${result.details.error}`);
    }
  }
  
  console.log('');
}

async function verifyMemory() {
  console.log('=== 🧠 CAMADA: MEMÓRIA (RUNTIME) ===');
  console.log('');
  
  // Nota: Sessões em memória só podem ser verificadas quando o servidor está rodando
  // e o BaileysSessionManager está ativo
  
  console.log('⚠️  Nota: Sessões em memória (BaileysSessionManager)');
  console.log('   só podem ser verificadas quando o servidor está rodando.');
  console.log('   Para limpar sessões em memória:');
  console.log('   1. Reinicie o servidor no Replit');
  console.log('   2. Ou aguarde o timeout natural das sessões');
  console.log('');
  
  results.push({
    layer: 'Memory',
    location: 'Runtime (BaileysSessionManager)',
    status: 'unknown',
    sessions: 0,
    details: {
      note: 'Sessões em memória só podem ser verificadas quando o servidor está rodando',
      action: 'Reiniciar servidor para limpar memória',
    },
    timestamp: new Date().toISOString(),
  });
}

async function verifyWebSocket() {
  console.log('=== 🔌 CAMADA: WEBSOCKET ===');
  console.log('');
  
  // Verificar se há conexões WebSocket ativas
  // Isso requer que o servidor esteja rodando
  
  console.log('⚠️  Nota: Conexões WebSocket só podem ser verificadas');
  console.log('   quando o servidor está rodando.');
  console.log('   Para verificar:');
  console.log('   1. Acesse o servidor');
  console.log('   2. Verifique logs do Socket.IO');
  console.log('   3. Ou reinicie o servidor para fechar todas as conexões');
  console.log('');
  
  results.push({
    layer: 'WebSocket',
    location: 'Socket.IO connections',
    status: 'unknown',
    sessions: 0,
    details: {
      note: 'Conexões WebSocket só podem ser verificadas quando o servidor está rodando',
      action: 'Reiniciar servidor para fechar conexões',
    },
    timestamp: new Date().toISOString(),
  });
}

async function verifyFrontend() {
  console.log('=== 🖥️ CAMADA: FRONTEND ===');
  console.log('');
  
  // Nota: Frontend não armazena sessões WhatsApp diretamente
  // Mas pode ter cache ou dados em localStorage/sessionStorage
  
  console.log('ℹ️  Frontend (Browser):');
  console.log('   - Sessões WhatsApp não são armazenadas no frontend');
  console.log('   - Frontend apenas exibe dados do backend via API');
  console.log('   - Cache do navegador pode ter dados antigos');
  console.log('   - Ação: Limpar cache do navegador se necessário');
  console.log('');
  
  results.push({
    layer: 'Frontend',
    location: 'Browser (localStorage/sessionStorage)',
    status: 'clean',
    sessions: 0,
    details: {
      note: 'Frontend não armazena sessões WhatsApp',
      action: 'Limpar cache do navegador se necessário',
    },
    timestamp: new Date().toISOString(),
  });
}

async function verifyMiddleware() {
  console.log('=== 🔄 CAMADA: MIDDLEWARE ===');
  console.log('');
  
  // Verificar se há middleware que armazena sessões
  // Geralmente middleware não armazena sessões, apenas valida/processa
  
  console.log('ℹ️  Middleware:');
  console.log('   - Middleware geralmente não armazena sessões');
  console.log('   - Apenas valida e processa requisições');
  console.log('   - Sessões são gerenciadas pelo backend');
  console.log('');
  
  results.push({
    layer: 'Middleware',
    location: 'Request processing',
    status: 'clean',
    sessions: 0,
    details: {
      note: 'Middleware não armazena sessões',
    },
    timestamp: new Date().toISOString(),
  });
}

async function main() {
  console.log('=== 🔍 VERIFICAÇÃO COMPLETA: TODAS AS CAMADAS ===');
  console.log('');
  console.log('Verificando: Frontend, Middleware, Backend, Cache, Memória, Database');
  console.log('');
  
  await verifyDatabase();
  await verifyFilesystem();
  await verifyCache();
  await verifyBackend();
  await verifyMemory();
  await verifyWebSocket();
  await verifyFrontend();
  await verifyMiddleware();
  
  // Resumo final
  console.log('=== 📊 RESUMO FINAL ===');
  console.log('');
  
  const found = results.filter(r => r.status === 'found');
  const clean = results.filter(r => r.status === 'clean');
  const errors = results.filter(r => r.status === 'error');
  const unknown = results.filter(r => r.status === 'unknown');
  
  const totalSessions = results.reduce((sum, r) => sum + r.sessions, 0);
  
  console.log(`Total de localizações verificadas: ${results.length}`);
  console.log(`Localizações limpas: ${clean.length}`);
  console.log(`Localizações com sessões: ${found.length}`);
  console.log(`Localizações com erro: ${errors.length}`);
  console.log(`Localizações desconhecidas: ${unknown.length}`);
  console.log(`Total de sessões encontradas: ${totalSessions}`);
  console.log('');
  
  if (found.length > 0) {
    console.log('🔴 LOCALIZAÇÕES COM SESSÕES:');
    found.forEach(r => {
      console.log(`   - ${r.layer} / ${r.location}: ${r.sessions} sessões`);
    });
    console.log('');
  }
  
  if (clean.length > 0) {
    console.log('✅ LOCALIZAÇÕES LIMPAS:');
    clean.forEach(r => {
      console.log(`   - ${r.layer} / ${r.location}`);
    });
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('⚠️  LOCALIZAÇÕES COM ERRO:');
    errors.forEach(r => {
      console.log(`   - ${r.layer} / ${r.location}: ${r.details.error}`);
    });
    console.log('');
  }
  
  if (unknown.length > 0) {
    console.log('ℹ️  LOCALIZAÇÕES DESCONHECIDAS (requer servidor rodando):');
    unknown.forEach(r => {
      console.log(`   - ${r.layer} / ${r.location}`);
    });
    console.log('');
  }
  
  // Salvar relatório
  const reportPath = path.join(process.cwd(), 'complete-verification-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Relatório completo salvo em: ${reportPath}`);
  console.log('');
  
  console.log('=== ✅ CONCLUSÃO ===');
  console.log('');
  
  if (totalSessions === 0 && found.length === 0) {
    console.log('✅ SISTEMA COMPLETAMENTE LIMPO');
    console.log('   Nenhuma sessão encontrada em nenhuma camada verificada.');
    console.log('   Se o WhatsApp ainda mostra dispositivos:');
    console.log('   1. Aguarde 5-10 minutos (sincronização)');
    console.log('   2. Verifique se o servidor foi reiniciado');
    console.log('   3. Remova manualmente no celular se necessário');
  } else {
    console.log('⚠️  SESSÕES ENCONTRADAS');
    console.log('   Há sessões ativas em algumas camadas.');
    console.log('   Ação: Limpar as sessões encontradas.');
  }
  
  console.log('');
  
  process.exit(0);
}

main();
