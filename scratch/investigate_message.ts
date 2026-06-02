import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '@/lib/db';
import { messages, automationLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import '@/lib/server-init';

async function investigate() {
  const msgId = '8a17e9b6-6573-4b33-a96d-06b78ff09f11';
  
  const [msg] = await db.select().from(messages).where(eq(messages.id, msgId));
  console.log('Mensagem:', msg);
  
  if (msg) {
    const logs = await db.select().from(automationLogs).where(eq(automationLogs.conversationId, msg.conversationId || ''));
    console.log(`Encontrados ${logs.length} logs para a conversa desta mensagem.`);
    for (const log of logs) {
       if (log.level === 'ERROR') {
          console.log(`LOG DE ERRO:`, log.message, log.details);
       }
    }
  }

  process.exit(0);
}

investigate().catch(console.error);
