
import { Redis } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  LIMPEZA DE CACHE REDIS (API SESSION REFRESH)                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL não definida no .env');
    process.exit(1);
  }

  const redis = new Redis(process.env.REDIS_URL);

  try {
    console.log('🧹 Buscando chaves de sessão...');
    
    // Padrão de chaves usado pelo session-cache.ts e api-cache.ts
    // Geralmente: "sessions:*", "connections:*", "api:cache:*"
    const keys = await redis.keys('*session*');
    const connectionKeys = await redis.keys('*connection*');
    const apiKeys = await redis.keys('*api:cache*');

    const allKeys = [...keys, ...connectionKeys, ...apiKeys];

    if (allKeys.length === 0) {
      console.log('✅ Nenhuma chave de cache encontrada para limpar.');
    } else {
      console.log(`found ${allKeys.length} chaves para remover.`);
      await redis.del(...allKeys);
      console.log('✅ Cache limpo com sucesso!');
    }

    // Forçar publicação de evento de atualização via Redis Pub/Sub (se houver)
    // Isso notifica as instâncias da API para recarregar
    await redis.publish('invalidate-cache', 'all');
    console.log('📢 Evento de invalidação publicado.');

  } catch (error) {
    console.error('❌ Erro ao limpar Redis:', error);
  } finally {
    redis.disconnect();
  }
}

main();
