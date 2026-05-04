/**
 * Verifica sessões WhatsApp nos servidores remotos via API
 * Tenta acessar os endpoints de sessões para verificar se há sessões ativas
 */

import * as https from 'https';
import * as http from 'http';

interface RemoteSessionCheck {
  server: string;
  url: string;
  status: 'success' | 'error' | 'unauthorized' | 'timeout';
  sessions?: any[];
  error?: string;
  responseTime?: number;
}

const servers = [
  {
    name: 'Produção',
    baseUrl: 'https://masteria.app',
  },
  {
    name: 'Desenvolvimento',
    baseUrl: 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev',
  },
];

async function checkSessionsViaAPI(server: { name: string; baseUrl: string }): Promise<RemoteSessionCheck> {
  return new Promise((resolve) => {
    const url = new URL(`${server.baseUrl}/api/v1/whatsapp/sessions`);
    const client = url.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const options = {
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Session-Checker/1.0',
      },
    };
    
    const req = client.request(url.toString(), options, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 401 || res.statusCode === 403) {
            resolve({
              server: server.name,
              url: server.baseUrl,
              status: 'unauthorized',
              responseTime,
              error: 'Autenticação necessária',
            });
            return;
          }
          
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            resolve({
              server: server.name,
              url: server.baseUrl,
              status: 'success',
              sessions: json.sessions || [],
              responseTime,
            });
          } else {
            resolve({
              server: server.name,
              url: server.baseUrl,
              status: 'error',
              responseTime,
              error: `HTTP ${res.statusCode}: ${data.substring(0, 100)}`,
            });
          }
        } catch (error: any) {
          resolve({
            server: server.name,
            url: server.baseUrl,
            status: 'error',
            responseTime,
            error: `Parse error: ${error.message}`,
          });
        }
      });
    });
    
    req.on('error', (error: any) => {
      resolve({
        server: server.name,
        url: server.baseUrl,
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        server: server.name,
        url: server.baseUrl,
        status: 'timeout',
        responseTime: Date.now() - startTime,
        error: 'Timeout após 10 segundos',
      });
    });
    
    req.end();
  });
}

async function checkHealthEndpoint(server: { name: string; baseUrl: string }): Promise<any> {
  return new Promise((resolve) => {
    const url = new URL(`${server.baseUrl}/api/v1/whatsapp/sessions/health`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url.toString(), { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function checkAllRemoteSessions() {
  console.log('=== 🌐 VERIFICAÇÃO DE SESSÕES REMOTAS VIA API ===');
  console.log('');
  console.log('Tentando verificar sessões nos servidores remotos...');
  console.log('');
  
  const results: RemoteSessionCheck[] = [];
  
  for (const server of servers) {
    console.log(`🔍 Verificando ${server.name} (${server.baseUrl})...`);
    
    // Tentar verificar health endpoint primeiro
    const health = await checkHealthEndpoint(server);
    if (health) {
      console.log(`   ✅ Health endpoint acessível`);
      if (health.checks?.sessions) {
        console.log(`   📊 Sessões ativas: ${health.checks.sessions.activeCount || 0}`);
      }
    }
    
    // Tentar verificar sessões via API
    const result = await checkSessionsViaAPI(server);
    results.push(result);
    
    if (result.status === 'success') {
      const sessionCount = result.sessions?.length || 0;
      console.log(`   ✅ API acessível (${result.responseTime}ms)`);
      console.log(`   📊 Sessões encontradas: ${sessionCount}`);
      
      if (sessionCount > 0 && result.sessions) {
        console.log('   Sessões:');
        result.sessions.forEach((s: any, idx: number) => {
          console.log(`      [${idx + 1}] ${s.name || s.id}`);
          console.log(`          Status: ${s.status || 'N/A'}`);
          console.log(`          Telefone: ${s.phone || 'N/A'}`);
          console.log(`          Ativo: ${s.isActive ? 'Sim' : 'Não'}`);
        });
      }
    } else if (result.status === 'unauthorized') {
      console.log(`   ⚠️  Autenticação necessária (${result.responseTime}ms)`);
      console.log(`   💡 A API requer autenticação. Acesse o servidor diretamente.`);
    } else if (result.status === 'timeout') {
      console.log(`   ⏱️  Timeout (${result.responseTime}ms)`);
    } else {
      console.log(`   ❌ Erro: ${result.error || 'Desconhecido'}`);
    }
    
    console.log('');
  }
  
  console.log('=== 📊 RESUMO ===');
  console.log('');
  
  const successful = results.filter(r => r.status === 'success');
  const withSessions = successful.filter(r => (r.sessions?.length || 0) > 0);
  const withoutSessions = successful.filter(r => (r.sessions?.length || 0) === 0);
  const errors = results.filter(r => r.status === 'error' || r.status === 'timeout');
  const unauthorized = results.filter(r => r.status === 'unauthorized');
  
  console.log(`Verificações bem-sucedidas: ${successful.length}`);
  console.log(`Servidores com sessões: ${withSessions.length}`);
  console.log(`Servidores sem sessões: ${withoutSessions.length}`);
  console.log(`Erros/Timeouts: ${errors.length}`);
  console.log(`Requer autenticação: ${unauthorized.length}`);
  console.log('');
  
  if (withSessions.length > 0) {
    console.log('🔴 SERVIDORES COM SESSÕES ATIVAS:');
    withSessions.forEach(r => {
      console.log(`   - ${r.server}: ${r.sessions?.length || 0} sessões`);
      r.sessions?.forEach((s: any) => {
        console.log(`     • ${s.name || s.id} (${s.status || 'N/A'})`);
      });
    });
    console.log('');
    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Há sessões ativas em servidores remotos!');
    console.log('   Acesse o Replit e execute:');
    console.log('   npx tsx scripts/cleanup-orphan-session-filesystem.ts');
    console.log('');
  }
  
  if (withoutSessions.length > 0) {
    console.log('✅ SERVIDORES SEM SESSÕES:');
    withoutSessions.forEach(r => {
      console.log(`   - ${r.server}`);
    });
    console.log('');
  }
  
  if (unauthorized.length > 0) {
    console.log('⚠️  SERVIDORES QUE REQUEREM AUTENTICAÇÃO:');
    unauthorized.forEach(r => {
      console.log(`   - ${r.server}: ${r.url}`);
    });
    console.log('');
    console.log('💡 Para verificar esses servidores:');
    console.log('   1. Acesse o Replit');
    console.log('   2. Execute: npx tsx scripts/investigate-all-environments.ts');
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('❌ SERVIDORES COM ERRO:');
    errors.forEach(r => {
      console.log(`   - ${r.server}: ${r.error || 'Erro desconhecido'}`);
    });
    console.log('');
  }
  
  console.log('=== 💡 CONCLUSÃO ===');
  console.log('');
  
  if (withSessions.length > 0) {
    console.log('🔴 SESSÕES ENCONTRADAS EM SERVIDORES REMOTOS!');
    console.log('   Isso explica por que o WhatsApp ainda mostra dispositivos conectados.');
    console.log('   Ação: Limpar sessões nos servidores remotos via Replit.');
  } else if (unauthorized.length > 0) {
    console.log('⚠️  Não foi possível verificar todos os servidores (autenticação necessária).');
    console.log('   Acesse o Replit para verificação manual.');
  } else if (withoutSessions.length > 0 && errors.length === 0) {
    console.log('✅ Nenhuma sessão encontrada nos servidores remotos.');
    console.log('   Se o WhatsApp ainda mostra dispositivos, aguarde sincronização (5-10 min).');
  } else {
    console.log('⚠️  Não foi possível verificar os servidores remotos.');
    console.log('   Acesse o Replit para verificação manual.');
  }
  
  console.log('');
  
  process.exit(0);
}

checkAllRemoteSessions();
