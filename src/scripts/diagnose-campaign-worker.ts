
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { initializeCampaignTriggerWorker, shutdownCampaignTriggerWorker } from '@/workers/campaign-trigger.worker';

async function diagnose() {
  console.log('🔍 Iniciando diagnóstico do CampaignTriggerWorker...');

  // 1. Verificar Campanhas Travadas
  console.log('\n📊 Verificando estado das campanhas no banco de dados...');
  
  const activeCampaigns = await db
    .select()
    .from(campaigns)
    .where(inArray(campaigns.status, ['QUEUED', 'PENDING', 'SENDING']));

  console.log(`Total de campanhas ativas (QUEUED/PENDING/SENDING): ${activeCampaigns.length}`);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const stuckCampaigns = activeCampaigns.filter(c => {
    return c.status === 'SENDING' && c.createdAt && new Date(c.createdAt) < fiveMinutesAgo;
  });

  if (stuckCampaigns.length > 0) {
    console.log(`⚠️ ALERTA: ${stuckCampaigns.length} campanhas parecem travadas em SENDING há mais de 5 minutos:`);
    stuckCampaigns.forEach(c => {
      console.log(`   - ID: ${c.id} | Nome: ${c.name} | Criado em: ${c.createdAt}`);
    });
  } else {
    console.log('✅ Nenhuma campanha travada detectada (todas as SENDING foram atualizadas recentemente ou não há nenhuma).');
  }

  // 2. Testar Inicialização do Worker (Simulação)
  console.log('\n⚙️ Testando inicialização do worker (Simulação em processo isolado)...');
  
  try {
    const success = await initializeCampaignTriggerWorker();
    if (success) {
      console.log('✅ Worker inicializou com sucesso neste processo de teste.');
      console.log('   Isso indica que o código do worker está funcional e sem erros de importação/dependência.');
    } else {
      console.error('❌ Worker falhou ao inicializar.');
    }
  } catch (error) {
    console.error('❌ EXCEÇÃO ao inicializar worker:', error);
  } finally {
    await shutdownCampaignTriggerWorker();
  }

  console.log('\n🏁 Diagnóstico concluído.');
  process.exit(0);
}

diagnose().catch(err => {
  console.error('Erro fatal no script de diagnóstico:', err);
  process.exit(1);
});
