/**
 * Verifica o estado atual do Replit após a limpeza
 * Tenta acessar endpoints e verificar se há sessões ativas
 */

import * as https from 'https';
import * as http from 'http';

interface VerificationResult {
  server: string;
  url: string;
  healthCheck: 'success' | 'error' | 'timeout';
  healthData?: any;
  sessionsEndpoint: 'success' | 'error' | 'unauthorized' | 'timeout';
  sessionsData?: any;
  timestamp: string;
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

async function checkHealth(server: { name: string; baseUrl: string }): Promise<{ status: string; data?: any }> {
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
          resolve({ status: 'success', data: JSON.parse(data) });
        } catch {
          resolve({ status: 'error' });
        }
      });
    });
    
    req.on('error', () => resolve({ status: 'error' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout' });
    });
  });
}

async function checkSessions(server: { name: string; baseUrl: string }): Promise<{ status: string; data?: any }> {
  return new Promise((resolve) => {
    const url = new URL(`${server.baseUrl}/api/v1/whatsapp/sessions`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url.toString(), { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          resolve({ status: 'unauthorized' });
          return;
        }
        try {
          resolve({ status: 'success', data: JSON.parse(data) });
        } catch {
          resolve({ status: 'error' });
        }
      });
    });
    
    req.on('error', () => resolve({ status: 'error' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout' });
    });
  });
}

async function verifyReplitCleanup() {
  console.log('=== 🔍 VERIFICAÇÃO DO ESTADO ATUAL DO REPLIT ===');
  console.log('');
  console.log('Verificando servidores após limpeza...');
  console.log('');
  
  const results: VerificationResult[] = [];
  
  for (const server of servers) {
    console.log(`🔍 Verificando ${server.name} (${server.baseUrl})...`);
    
    // Health check
    const health = await checkHealth(server);
    console.log(`   Health endpoint: ${health.status}`);
    if (health.status === 'success' && health.data) {
      console.log(`   Status: ${health.data.status || 'N/A'}`);
      if (health.data.checks?.sessions) {
        console.log(`   Sessões ativas: ${health.data.checks.sessions.activeCount || 0}`);
      }
    }
    
    // Sessions check
    const sessions = await checkSessions(server);
    console.log(`   Sessions endpoint: ${sessions.status}`);
    if (sessions.status === 'success' && sessions.data) {
      const sessionCount = sessions.data.sessions?.length || 0;
      console.log(`   Sessões encontradas: ${sessionCount}`);
      if (sessionCount > 0) {
        console.log('   ⚠️  SESSÕES AINDA ATIVAS:');
        sessions.data.sessions.forEach((s: any, idx: number) => {
          console.log(`      [${idx + 1}] ${s.name || s.id}`);
          console.log(`          Status: ${s.status || 'N/A'}`);
          console.log(`          Telefone: ${s.phone || 'N/A'}`);
        });
      }
    }
    
    results.push({
      server: server.name,
      url: server.baseUrl,
      healthCheck: health.status as any,
      healthData: health.data,
      sessionsEndpoint: sessions.status as any,
      sessionsData: sessions.data,
      timestamp: new Date().toISOString(),
    });
    
    console.log('');
  }
  
  console.log('=== 📊 RESUMO ===');
  console.log('');
  
  const serversWithSessions = results.filter(r => 
    r.sessionsEndpoint === 'success' && 
    r.sessionsData?.sessions?.length > 0
  );
  
  const serversWithoutSessions = results.filter(r => 
    r.sessionsEndpoint === 'success' && 
    (!r.sessionsData?.sessions || r.sessionsData.sessions.length === 0)
  );
  
  if (serversWithSessions.length > 0) {
    console.log('🔴 SERVIDORES COM SESSÕES ATIVAS:');
    serversWithSessions.forEach(r => {
      console.log(`   - ${r.server}: ${r.sessionsData.sessions.length} sessões`);
    });
    console.log('');
    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Há sessões ainda ativas nos servidores remotos!');
    console.log('   Isso explica por que o WhatsApp ainda mostra dispositivos conectados.');
    console.log('');
  }
  
  if (serversWithoutSessions.length > 0) {
    console.log('✅ SERVIDORES SEM SESSÕES:');
    serversWithoutSessions.forEach(r => {
      console.log(`   - ${r.server}`);
    });
    console.log('');
  }
  
  // Salvar relatório
  const reportPath = 'replit-verification-report.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Relatório salvo em: ${reportPath}`);
  console.log('');
  
  console.log('=== 💡 ANÁLISE ===');
  console.log('');
  
  if (serversWithSessions.length > 0) {
    console.log('🔴 CAUSA IDENTIFICADA:');
    console.log('   Há sessões ativas nos servidores remotos.');
    console.log('   A limpeza pode não ter sido executada completamente ou');
    console.log('   as sessões foram recriadas após a limpeza.');
    console.log('');
    console.log('💡 SOLUÇÃO:');
    console.log('   1. Acesse o Replit novamente');
    console.log('   2. Execute: npx tsx scripts/cleanup-all-baileys-sessions.ts');
    console.log('   3. Aguarde 5-10 minutos para sincronização');
    console.log('');
  } else if (serversWithoutSessions.length > 0) {
    console.log('✅ LIMPEZA CONFIRMADA:');
    console.log('   Nenhuma sessão encontrada nos servidores remotos.');
    console.log('   Se o WhatsApp ainda mostra dispositivos, pode ser:');
    console.log('   1. Cache do WhatsApp (aguarde mais 5-10 minutos)');
    console.log('   2. Outro servidor/instância não identificado');
    console.log('   3. Sessão conectada via outro método (WhatsApp Web direto)');
    console.log('');
  } else {
    console.log('⚠️  Não foi possível verificar completamente:');
    console.log('   Alguns endpoints requerem autenticação ou estão inacessíveis.');
    console.log('   Acesse o Replit para verificação manual.');
    console.log('');
  }
  
  process.exit(0);
}

verifyReplitCleanup();
