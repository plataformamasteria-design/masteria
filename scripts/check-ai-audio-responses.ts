
import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, and, desc, gt } from 'drizzle-orm';

async function checkAIAudioResponses() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  AUDITORIA DE RESPOSTAS DE ÁUDIO DA IA                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        // Buscar mensagens enviadas pela IA que sejam do tipo AUDIO nas últimas 24h
        const audioMessages = await db.select()
            .from(messages)
            .where(and(
                eq(messages.senderType, 'AI'),
                eq(messages.contentType, 'AUDIO'),
                gt(messages.sentAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
            ))
            .orderBy(desc(messages.sentAt))
            .limit(10);

        if (audioMessages.length === 0) {
            console.log('❌ Nenhuma resposta de áudio da IA encontrada nas últimas 24h.');
        } else {
            console.log(`✅ Encontradas ${audioMessages.length} respostas de áudio da IA:`);
            audioMessages.forEach((msg, index) => {
                console.log(`\n[${index + 1}] ID: ${msg.id}`);
                console.log(`    Data: ${msg.sentAt?.toLocaleString('pt-BR')}`);
                console.log(`    Sender ID: ${msg.senderId}`);
                console.log(`    Media URL: ${msg.mediaUrl}`);
                console.log(`    Status: ${msg.status}`);
                console.log('---------------------------------------------------');
            });
        }

    } catch (error) {
        console.error('Erro na auditoria:', error);
    }
    process.exit(0);
}

checkAIAudioResponses();
