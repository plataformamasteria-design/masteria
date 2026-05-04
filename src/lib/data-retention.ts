
// src/lib/data-retention.ts
'use server';

import { db, aiChatMessages } from './db';
import { lte } from 'drizzle-orm';
import { subDays } from 'date-fns';

const ANONYMIZED_CONTENT_PLACEHOLDER = '[Conteúdo Expirado por Política de Retenção]';

/**
 * Anonymizes the content of AI chat messages older than a specified number of days.
 * This is intended to be run as a periodic task (e.g., a daily cron job).
 * @param days - The number of days to retain message content. Defaults to 30.
 */
export async function anonymizeOldChatMessages(days = 30): Promise<{ anonymizedCount: number }> {
  console.log(`[Data Retention] Iniciando processo para anonimizar mensagens com mais de ${days} dias...`);
  
  try {
    const cutoffDate = subDays(new Date(), days);

    const result = await db.update(aiChatMessages)
      .set({ 
        content: ANONYMIZED_CONTENT_PLACEHOLDER,
       })
      .where(lte(aiChatMessages.createdAt, cutoffDate));

    const anonymizedCount = Array.isArray(result) ? result.length : ((result as any)?.rowCount ?? 0);

    console.log(`[Data Retention] Processo concluído. ${anonymizedCount} mensagens foram anonimizadas.`);
    return { anonymizedCount };

  } catch (error) {
    console.error('[Data Retention] Erro ao anonimizar mensagens antigas:', error);
    throw new Error('Falha no processo de retenção de dados.');
  }
}
