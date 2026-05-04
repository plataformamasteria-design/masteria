/**
 * Script para INVESTIGAR e LIMPAR todas as sessões WhatsApp Baileys
 * 
 * Executa:
 * 1. Lista todas as sessões no banco de dados (todas as empresas)
 * 2. Lista todas as sessões no filesystem
 * 3. Lista todas as sessões em memória (se o servidor estiver rodando)
 * 4. Desconecta, deleta e limpa TUDO
 * 
 * Uso: npx tsx scripts/cleanup-all-baileys-sessions.ts
 */

import { db } from '../src/lib/db';
import { connections, baileysAuthState, campaigns } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

const SESSIONS_PATH = path.join(process.cwd(), 'whatsapp_sessions');

interface SessionReport {
  database: {
    connections: Array<{
      id: string;
      companyId: string;
      configName: string;
      phone: string | null;
      status: string | null;
      environment: string | null;
      lastConnected: Date | null;
    }>;
    authStates: Array<{
      id: string;
      connectionId: string;
      companyId: string | null;
    }>;
  };
  filesystem: string[];
  orphanedFilesystem: string[]; // Sessões no filesystem sem correspondência no DB
  orphanedDatabase: string[]; // Sessões no DB sem correspondência no filesystem
}

async function investigateSessions(): Promise<SessionReport> {
  console.log('\n🔍 ========== INVESTIGAÇÃO DE SESSÕES BAILEYS ==========\n');

  // 1. Buscar todas as conexões Baileys no banco de dados
  console.log('📊 Buscando conexões no banco de dados...');
  const dbConnections = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  console.log(`   ✅ Encontradas ${dbConnections.length} conexões baileys no banco\n`);
  
  // Listar detalhes
  if (dbConnections.length > 0) {
    console.log('   📋 DETALHES DAS CONEXÕES:');
    console.log('   ' + '-'.repeat(100));
    for (const conn of dbConnections) {
      console.log(`   ID: ${conn.id}`);
      console.log(`   Nome: ${conn.config_name}`);
      console.log(`   Empresa: ${conn.companyId}`);
      console.log(`   Telefone: ${conn.phone || 'N/A'}`);
      console.log(`   Status: ${conn.status || 'N/A'}`);
      console.log(`   Ambiente: ${conn.environment || 'N/A'}`);
      console.log(`   Última conexão: ${conn.lastConnected || 'N/A'}`);
      console.log(`   Ativo: ${conn.isActive}`);
      console.log('   ' + '-'.repeat(100));
    }
    console.log('');
  }

  // 2. Buscar auth states
  console.log('🔑 Buscando auth states no banco de dados...');
  const authStates = await db.query.baileysAuthState.findMany();
  console.log(`   ✅ Encontrados ${authStates.length} auth states no banco\n`);

  // 3. Buscar sessões no filesystem
  console.log('📁 Buscando sessões no filesystem...');
  let filesystemSessions: string[] = [];
  try {
    const entries = await fs.readdir(SESSIONS_PATH, { withFileTypes: true });
    filesystemSessions = entries
      .filter(e => e.isDirectory() && e.name.startsWith('session_'))
      .map(e => e.name.replace('session_', ''));
    console.log(`   ✅ Encontradas ${filesystemSessions.length} pastas de sessão no filesystem\n`);
    
    if (filesystemSessions.length > 0) {
      console.log('   📋 PASTAS DE SESSÃO:');
      for (const sessionId of filesystemSessions) {
        const sessionPath = path.join(SESSIONS_PATH, `session_${sessionId}`);
        try {
          const files = await fs.readdir(sessionPath);
          console.log(`   - session_${sessionId} (${files.length} arquivos)`);
        } catch {
          console.log(`   - session_${sessionId} (erro ao ler)`);
        }
      }
      console.log('');
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('   ⚠️  Pasta whatsapp_sessions não existe\n');
    } else {
      throw error;
    }
  }

  // 4. Identificar sessões órfãs
  const dbConnectionIds = new Set(dbConnections.map(c => c.id));
  const filesystemIds = new Set(filesystemSessions);
  
  const orphanedFilesystem = filesystemSessions.filter(id => !dbConnectionIds.has(id));
  const orphanedDatabase = dbConnections.filter(c => !filesystemIds.has(c.id)).map(c => c.id);

  console.log('⚠️  SESSÕES ÓRFÃS:');
  console.log(`   - Filesystem sem DB: ${orphanedFilesystem.length}`);
  if (orphanedFilesystem.length > 0) {
    orphanedFilesystem.forEach(id => console.log(`     • ${id}`));
  }
  console.log(`   - DB sem Filesystem: ${orphanedDatabase.length}`);
  if (orphanedDatabase.length > 0) {
    orphanedDatabase.forEach(id => console.log(`     • ${id}`));
  }
  console.log('');

  return {
    database: {
      connections: dbConnections.map(c => ({
        id: c.id,
        companyId: c.companyId,
        configName: c.config_name,
        phone: c.phone,
        status: c.status,
        environment: c.environment,
        lastConnected: c.lastConnected,
      })),
      authStates: authStates.map(a => ({
        id: a.id,
        connectionId: a.connectionId,
        companyId: a.companyId,
      })),
    },
    filesystem: filesystemSessions,
    orphanedFilesystem,
    orphanedDatabase,
  };
}

async function cleanupAllSessions(report: SessionReport): Promise<void> {
  console.log('\n🧹 ========== LIMPEZA DE TODAS AS SESSÕES ==========\n');
  
  const totalToClean = 
    report.database.connections.length + 
    report.database.authStates.length + 
    report.filesystem.length;
    
  if (totalToClean === 0) {
    console.log('✅ Nenhuma sessão para limpar!\n');
    return;
  }

  console.log(`⚠️  ATENÇÃO: Serão removidas ${totalToClean} entradas no total\n`);

  // 1. Limpar auth states do banco
  if (report.database.authStates.length > 0) {
    console.log('🗑️  Deletando auth states do banco...');
    for (const authState of report.database.authStates) {
      await db.delete(baileysAuthState).where(eq(baileysAuthState.id, authState.id));
      console.log(`   ✅ Auth state deletado: ${authState.id}`);
    }
    console.log('');
  }

  // 2. Desvincular campanhas das conexões
  console.log('🔗 Desvinculando campanhas das conexões baileys...');
  for (const conn of report.database.connections) {
    await db.update(campaigns)
      .set({ connectionId: null })
      .where(eq(campaigns.connectionId, conn.id));
    console.log(`   ✅ Campanhas desvinculadas de: ${conn.id}`);
  }
  console.log('');

  // 3. Deletar conexões do banco
  if (report.database.connections.length > 0) {
    console.log('🗑️  Deletando conexões do banco...');
    for (const conn of report.database.connections) {
      await db.delete(connections).where(eq(connections.id, conn.id));
      console.log(`   ✅ Conexão deletada: ${conn.id} (${conn.configName})`);
    }
    console.log('');
  }

  // 4. Deletar pastas do filesystem
  if (report.filesystem.length > 0) {
    console.log('🗑️  Deletando pastas de sessão do filesystem...');
    for (const sessionId of report.filesystem) {
      const sessionPath = path.join(SESSIONS_PATH, `session_${sessionId}`);
      try {
        await fs.rm(sessionPath, { recursive: true, force: true });
        console.log(`   ✅ Pasta deletada: session_${sessionId}`);
      } catch (error: any) {
        console.log(`   ⚠️  Erro ao deletar session_${sessionId}: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('✅ ========== LIMPEZA CONCLUÍDA ==========\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  SCRIPT DE LIMPEZA DE SESSÕES WHATSAPP BAILEYS                 ║');
  console.log('║  Este script vai INVESTIGAR e DELETAR todas as sessões         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Safety Check
  if (process.env.FORCE_CLEANUP !== 'true') {
    console.log('\n❌ ERRO DE SEGURANÇA:');
    console.log('   Este script é DESTRUTIVO e apaga TODAS as sessões de produção.');
    console.log('   Para executar, você deve definir a variável de ambiente:');
    console.log('   $env:FORCE_CLEANUP="true" (PowerShell) ou export FORCE_CLEANUP=true (Bash)');
    console.log('\n   Operação abortada para prevenir perda de dados.');
    process.exit(1);
  }

  try {
    // Fase 1: Investigação
    const report = await investigateSessions();

    // Salvar relatório em JSON
    const reportPath = path.join(process.cwd(), 'baileys_sessions_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório salvo em: ${reportPath}\n`);

    // Fase 2: Limpeza
    await cleanupAllSessions(report);

    // Fase 3: Verificação final
    console.log('🔍 VERIFICAÇÃO FINAL...');
    const finalReport = await investigateSessions();
    
    if (
      finalReport.database.connections.length === 0 &&
      finalReport.database.authStates.length === 0 &&
      finalReport.filesystem.length === 0
    ) {
      console.log('✅✅✅ TODAS AS SESSÕES FORAM COMPLETAMENTE REMOVIDAS! ✅✅✅\n');
    } else {
      console.log('⚠️  Ainda existem algumas sessões (pode ser necessário execução manual)');
    }

  } catch (error) {
    console.error('❌ Erro durante execução:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
