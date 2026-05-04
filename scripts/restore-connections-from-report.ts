
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

// Interface baseada no relatório gerado
interface ConnectionReport {
  id: string;
  companyId: string;
  configName: string;
  phone: string | null;
  status: string | null;
  environment: string | null;
  lastConnected: string | null;
}

interface ReportFile {
  database: {
    connections: ConnectionReport[];
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  RESTAURADOR DE REGISTROS DE CONEXÃO (DB RECOVERY)             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const reportPath = path.join(process.cwd(), 'baileys_sessions_report.json');

  try {
    // 1. Ler arquivo de relatório
    console.log('📂 Lendo relatório de backup (baileys_sessions_report.json)...');
    const data = await fs.readFile(reportPath, 'utf-8');
    const report: ReportFile = JSON.parse(data);

    const connsToRestore = report.database.connections;
    console.log(`📊 Encontradas ${connsToRestore.length} conexões no histórico para restaurar.`);

    if (connsToRestore.length === 0) {
      console.log('❌ Nenhuma conexão encontrada no relatório para restaurar.');
      return;
    }

    // 2. Processar restauração
    console.log('\n🔄 Iniciando restauração...');
    
    for (const connData of connsToRestore) {
      // Verificar se já existe
      const existing = await db.query.connections.findFirst({
        where: eq(connections.id, connData.id)
      });

      if (existing) {
        console.log(`   ⚠️  Conexão já existe: ${connData.configName} (${connData.id}) - Pulando.`);
        continue;
      }

      console.log(`   ➕ Restaurando: ${connData.configName} (${connData.phone || 'Sem número'})...`);
      
      // Inserir no banco
      await db.insert(connections).values({
        id: connData.id,
        companyId: connData.companyId,
        config_name: connData.configName,
        connectionType: 'baileys', // Forçando tipo correto
        phone: connData.phone,
        status: 'disconnected', // Restaurar como desconectado para forçar reconexão limpa
        environment: connData.environment || 'production',
        isActive: true, // Reativar para aparecer na lista
        lastConnected: connData.lastConnected ? new Date(connData.lastConnected) : null,
        createdAt: new Date(),
      });
      
      console.log(`      ✅ Sucesso!`);
    }

    console.log('\n✅ Processo de restauração concluído!');
    console.log('⚠️  NOTA: As conexões foram restauradas no PAINEL.');
    console.log('   Como os arquivos de sessão (chaves criptográficas) foram deletados do disco,');
    console.log('   os usuários PRECISARÃO escanear o QR Code novamente para funcionar.');

  } catch (error) {
    console.error('❌ Erro ao ler relatório ou restaurar:', error);
  }

  process.exit(0);
}

main();
