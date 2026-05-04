/**
 * VERIFICAÇÃO COMPLETA: Todas as empresas (Multi-Tenant)
 * Verifica sessões em cada empresa individualmente
 */

import { db } from '../src/lib/db';
import { connections, baileysAuthState } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { redis } from '../src/lib/redis';

interface CompanySessionReport {
  companyId: string;
  companyName?: string;
  database: {
    connections: number;
    sessions: any[];
    authStates: number;
  };
  filesystem: {
    sessions: number;
    paths: string[];
  };
  cache: {
    keys: number;
    sessionKeys: string[];
  };
}

async function verifyAllCompanies() {
  console.log('=== 🔍 VERIFICAÇÃO COMPLETA: TODAS AS EMPRESAS (MULTI-TENANT) ===');
  console.log('');
  
  // 1. Listar todas as empresas
  console.log('1️⃣ LISTANDO TODAS AS EMPRESAS');
  const allCompanies = await db.query.companies.findMany({
    columns: {
      id: true,
      name: true,
    },
  });
  
  console.log(`   Total de empresas encontradas: ${allCompanies.length}`);
  allCompanies.forEach((c, idx) => {
    console.log(`   [${idx + 1}] ${c.name || 'Sem nome'} (ID: ${c.id})`);
  });
  console.log('');
  
  // 2. Verificar sessões por empresa
  console.log('2️⃣ VERIFICANDO SESSÕES POR EMPRESA');
  console.log('');
  
  const reports: CompanySessionReport[] = [];
  
  for (const company of allCompanies) {
    console.log(`🔍 Empresa: ${company.name || 'Sem nome'} (${company.id})`);
    
    // Database - Connections
    const companyConnections = await db.query.connections.findMany({
      where: eq(connections.companyId, company.id),
    });
    
    const baileysConnections = companyConnections.filter(c => c.connectionType === 'baileys');
    
    // Database - Auth States
    const companyAuthStates = await db.query.baileysAuthState.findMany({
      where: eq(baileysAuthState.companyId, company.id),
    });
    
    // Filesystem - Verificar pastas de sessão
    const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
    const fsSessions: string[] = [];
    try {
      const items = await fs.readdir(sessionsPath, { withFileTypes: true });
      const sessionDirs = items.filter(item => item.isDirectory() && item.name.startsWith('session_'));
      
      // Verificar cada pasta para ver se pertence a esta empresa
      for (const dir of sessionDirs) {
        const connectionId = dir.name.replace('session_', '');
        // Verificar se esta connectionId pertence a esta empresa
        const connection = await db.query.connections.findFirst({
          where: eq(connections.id, connectionId),
        });
        
        if (connection && connection.companyId === company.id) {
          fsSessions.push(dir.name);
        } else if (!connection) {
          // Sessão órfã - pode pertencer a qualquer empresa ou nenhuma
          fsSessions.push(dir.name);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.log(`   ⚠️  Erro ao verificar filesystem: ${error.message}`);
      }
    }
    
    // Cache Redis - Verificar chaves por empresa
    let cacheKeys: string[] = [];
    try {
      const allKeys = await redis.keys(`whatsapp:sessions:${company.id}*`);
      cacheKeys = allKeys;
    } catch (error: any) {
      // Ignorar erros de cache
    }
    
    const report: CompanySessionReport = {
      companyId: company.id,
      companyName: company.name || undefined,
      database: {
        connections: baileysConnections.length,
        sessions: baileysConnections.map(c => ({
          id: c.id,
          name: c.config_name,
          status: c.status,
          phone: c.phone,
          isActive: c.isActive,
        })),
        authStates: companyAuthStates.length,
      },
      filesystem: {
        sessions: fsSessions.length,
        paths: fsSessions,
      },
      cache: {
        keys: cacheKeys.length,
        sessionKeys: cacheKeys,
      },
    };
    
    reports.push(report);
    
    // Exibir resultados
    console.log(`   📊 Banco de dados:`);
    console.log(`      - Conexões Baileys: ${baileysConnections.length}`);
    if (baileysConnections.length > 0) {
      baileysConnections.forEach(s => {
        console.log(`        • ${s.config_name} | ${s.status} | ${s.phone || 'N/A'}`);
      });
    }
    console.log(`      - Auth States: ${companyAuthStates.length}`);
    
    console.log(`   📁 Filesystem:`);
    console.log(`      - Pastas de sessão: ${fsSessions.length}`);
    if (fsSessions.length > 0) {
      fsSessions.forEach(p => {
        console.log(`        • ${p}`);
      });
    }
    
    console.log(`   💾 Cache Redis:`);
    console.log(`      - Chaves: ${cacheKeys.length}`);
    if (cacheKeys.length > 0) {
      cacheKeys.forEach(k => {
        console.log(`        • ${k}`);
      });
    }
    
    console.log('');
  }
  
  // 3. Verificar sessões órfãs (sem empresa)
  console.log('3️⃣ VERIFICANDO SESSÕES ÓRFÃS (SEM EMPRESA)');
  console.log('');
  
  // Todas as conexões Baileys
  const allBaileysConnections = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  // Todas as pastas de sessão no filesystem
  let allFsSessions: string[] = [];
  try {
    const sessionsPath = path.join(process.cwd(), 'whatsapp_sessions');
    const items = await fs.readdir(sessionsPath, { withFileTypes: true });
    const sessionDirs = items.filter(item => item.isDirectory() && item.name.startsWith('session_'));
    allFsSessions = sessionDirs.map(d => d.name.replace('session_', ''));
  } catch {
    // Pasta não existe
  }
  
  // Encontrar sessões órfãs no filesystem
  const orphanSessions: string[] = [];
  for (const sessionId of allFsSessions) {
    const connection = await db.query.connections.findFirst({
      where: eq(connections.id, sessionId),
    });
    if (!connection) {
      orphanSessions.push(sessionId);
    }
  }
  
  console.log(`   Sessões órfãs no filesystem: ${orphanSessions.length}`);
  if (orphanSessions.length > 0) {
    orphanSessions.forEach(s => {
      console.log(`   - session_${s}`);
    });
  }
  console.log('');
  
  // 4. Resumo final
  console.log('=== 📊 RESUMO FINAL (TODAS AS EMPRESAS) ===');
  console.log('');
  
  const totalDbSessions = reports.reduce((sum, r) => sum + r.database.connections, 0);
  const totalFsSessions = reports.reduce((sum, r) => sum + r.filesystem.sessions, 0);
  const totalCacheKeys = reports.reduce((sum, r) => sum + r.cache.keys, 0);
  
  console.log(`Total de empresas verificadas: ${allCompanies.length}`);
  console.log(`Total de sessões no banco (todas empresas): ${totalDbSessions}`);
  console.log(`Total de sessões no filesystem (todas empresas): ${totalFsSessions}`);
  console.log(`Total de chaves de cache (todas empresas): ${totalCacheKeys}`);
  console.log(`Sessões órfãs no filesystem: ${orphanSessions.length}`);
  console.log('');
  
  // Empresas com sessões
  const companiesWithSessions = reports.filter(r => 
    r.database.connections > 0 || 
    r.filesystem.sessions > 0 || 
    r.cache.keys > 0
  );
  
  if (companiesWithSessions.length > 0) {
    console.log('🔴 EMPRESAS COM SESSÕES:');
    companiesWithSessions.forEach(r => {
      console.log(`   - ${r.companyName || r.companyId}:`);
      console.log(`     • Banco: ${r.database.connections} sessões`);
      console.log(`     • Filesystem: ${r.filesystem.sessions} pastas`);
      console.log(`     • Cache: ${r.cache.keys} chaves`);
    });
    console.log('');
  } else {
    console.log('✅ NENHUMA EMPRESA COM SESSÕES');
    console.log('   Todas as empresas estão limpas.');
    console.log('');
  }
  
  if (orphanSessions.length > 0) {
    console.log('⚠️  SESSÕES ÓRFÃS ENCONTRADAS:');
    console.log('   Essas sessões estão no filesystem mas não têm entrada no banco.');
    console.log('   Ação: Executar limpeza de sessões órfãs.');
    console.log('');
  }
  
  // Salvar relatório
  const reportPath = path.join(process.cwd(), 'all-companies-sessions-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    companies: reports,
    orphanSessions,
    summary: {
      totalCompanies: allCompanies.length,
      totalDbSessions,
      totalFsSessions,
      totalCacheKeys,
      orphanSessionsCount: orphanSessions.length,
    },
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log(`📄 Relatório salvo em: ${reportPath}`);
  console.log('');
  
  console.log('=== ✅ CONCLUSÃO ===');
  console.log('');
  
  if (totalDbSessions === 0 && totalFsSessions === 0 && totalCacheKeys === 0 && orphanSessions.length === 0) {
    console.log('✅ TODAS AS EMPRESAS ESTÃO LIMPAS');
    console.log('   Nenhuma sessão encontrada em nenhuma empresa.');
    console.log('   A limpeza foi aplicada a todas as empresas (multi-tenant).');
  } else {
    console.log('⚠️  SESSÕES ENCONTRADAS EM ALGUMAS EMPRESAS');
    console.log('   Verifique o relatório acima para detalhes.');
  }
  
  console.log('');
  
  process.exit(0);
}

verifyAllCompanies();
