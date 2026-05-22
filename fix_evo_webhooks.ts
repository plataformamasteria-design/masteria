import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { evolutionApiService } from './src/services/evolution-api.service';

async function fixWebhooks() {
  console.log('Iniciando correção de webhooks do Evolution API...');
  
  // Usar a URL oficial de produção, já que localhost:3000 não recebe webhooks externos
  const productionWebhookUrl = 'https://masteria.app/api/v1/webhooks/evolution';
  
  const evConns = await db.select().from(connections).where(eq(connections.connectionType, 'evolution'));
  
  console.log(`Encontradas ${evConns.length} conexões Evolution.`);
  
  for (const conn of evConns) {
    try {
      console.log(`Tentando registrar webhook para a instância [${conn.config_name}] (${conn.id})...`);
      await evolutionApiService.setWebhook(conn.id, productionWebhookUrl);
      console.log(`✅ Webhook atualizado com sucesso para: ${conn.config_name}`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar webhook para ${conn.config_name}:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('Processo finalizado.');
  process.exit(0);
}

fixWebhooks().catch(console.error);
