/**
 * Verifica servidores remotos e outras instâncias do sistema
 * Tenta detectar se há outras cópias rodando ou sessões em outros locais
 */

import * as https from 'https';
import * as http from 'http';

interface ServerCheck {
  url: string;
  name: string;
  status: 'online' | 'offline' | 'error' | 'unknown';
  responseTime?: number;
  details?: any;
}

const serversToCheck: ServerCheck[] = [
  {
    url: 'https://masteria.app',
    name: 'Produção (masteria.app)',
    status: 'unknown',
  },
  {
    url: 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev',
    name: 'Desenvolvimento (Replit)',
    status: 'unknown',
  },
];

async function checkServer(server: ServerCheck): Promise<ServerCheck> {
  return new Promise((resolve) => {
    const url = new URL(server.url);
    const client = url.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const req = client.get(url.toString(), { timeout: 5000 }, (res) => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode || 0;
      
      resolve({
        ...server,
        status: statusCode >= 200 && statusCode < 400 ? 'online' : 'error',
        responseTime,
        details: {
          statusCode,
          headers: {
            server: res.headers.server,
            'x-powered-by': res.headers['x-powered-by'],
            'x-vercel-id': res.headers['x-vercel-id'],
          },
        },
      });
      
      res.resume(); // Consume response to free up memory
    });
    
    req.on('error', (error: any) => {
      resolve({
        ...server,
        status: 'offline',
        details: { error: error.message },
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        ...server,
        status: 'offline',
        details: { error: 'Timeout' },
      });
    });
  });
}

async function checkAllServers() {
  console.log('=== 🌐 VERIFICAÇÃO DE SERVIDORES REMOTOS ===');
  console.log('');
  console.log('Verificando se os servidores estão online...');
  console.log('');
  
  const results: ServerCheck[] = [];
  
  for (const server of serversToCheck) {
    process.stdout.write(`   Verificando ${server.name}... `);
    const result = await checkServer(server);
    results.push(result);
    
    if (result.status === 'online') {
      console.log(`✅ Online (${result.responseTime}ms)`);
    } else if (result.status === 'offline') {
      console.log(`❌ Offline`);
    } else {
      console.log(`⚠️  Erro (${result.details?.error || 'Desconhecido'})`);
    }
  }
  
  console.log('');
  console.log('=== 📊 RESUMO ===');
  console.log('');
  
  const onlineServers = results.filter(r => r.status === 'online');
  const offlineServers = results.filter(r => r.status === 'offline');
  const errorServers = results.filter(r => r.status === 'error');
  
  console.log(`Servidores online: ${onlineServers.length}`);
  console.log(`Servidores offline: ${offlineServers.length}`);
  console.log(`Servidores com erro: ${errorServers.length}`);
  console.log('');
  
  if (onlineServers.length > 0) {
    console.log('✅ SERVIDORES ONLINE:');
    onlineServers.forEach(s => {
      console.log(`   - ${s.name}`);
      console.log(`     URL: ${s.url}`);
      console.log(`     Tempo de resposta: ${s.responseTime}ms`);
      if (s.details?.headers) {
        const headers = s.details.headers;
        if (headers.server) console.log(`     Server: ${headers.server}`);
        if (headers['x-vercel-id']) console.log(`     Vercel ID: ${headers['x-vercel-id']}`);
      }
      console.log('');
    });
  }
  
  if (offlineServers.length > 0) {
    console.log('❌ SERVIDORES OFFLINE:');
    offlineServers.forEach(s => {
      console.log(`   - ${s.name}`);
      console.log(`     URL: ${s.url}`);
      if (s.details?.error) {
        console.log(`     Erro: ${s.details.error}`);
      }
      console.log('');
    });
  }
  
  console.log('=== 💡 RECOMENDAÇÕES ===');
  console.log('');
  
  if (onlineServers.length > 0) {
    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Os servidores estão online e podem ter sessões ativas.');
    console.log('   Execute a investigação em cada servidor:');
    console.log('');
    onlineServers.forEach(s => {
      console.log(`   1. Acesse: ${s.url}`);
      console.log(`   2. Execute: npx tsx scripts/investigate-all-environments.ts`);
      console.log(`   3. Se encontrar sessões, execute: npx tsx scripts/cleanup-orphan-session-filesystem.ts`);
      console.log('');
    });
  } else {
    console.log('✅ Todos os servidores estão offline ou inacessíveis.');
    console.log('   Isso pode significar que não há sessões ativas em servidores remotos.');
    console.log('');
  }
  
  console.log('📝 NOTA:');
  console.log('   Esta verificação apenas confirma se os servidores estão online.');
  console.log('   Para verificar sessões, você precisa acessar cada servidor e executar os scripts de investigação.');
  console.log('');
  
  process.exit(0);
}

checkAllServers();
