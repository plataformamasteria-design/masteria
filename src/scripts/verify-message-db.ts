import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const messageId = '5d1cc20b-8dd5-400f-84af-685b8bc14f6c';
const conversationId = '17ee8ff9-1f76-4ec0-8d4e-704f34e370e9';

async function verify() {
    const client = postgres(process.env.DATABASE_URL!);
    const db = drizzle(client);

    console.log('\n📋 Verificando mensagem no banco de dados...\n');

    // Check the specific message
    const message = await db.execute(sql`
        SELECT id, content, sender_type, status, sent_at 
        FROM messages 
        WHERE id = ${messageId}
    `);

    console.log('📧 Mensagem encontrada:');
    console.log(JSON.stringify(message, null, 2));

    // Check the conversation
    const conversation = await db.execute(sql`
        SELECT id, status, source, created_at 
        FROM conversations 
        WHERE id = ${conversationId}
    `);

    console.log('\n💬 Conversa encontrada:');
    console.log(JSON.stringify(conversation, null, 2));

    // Count recent messages
    const recentMessages = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM messages 
        WHERE sent_at > NOW() - INTERVAL '1 hour'
    `);

    console.log('\n📊 Mensagens na última hora:');
    console.log(JSON.stringify(recentMessages, null, 2));

    await client.end();
    console.log('\n✅ Verificação completa!');
}

verify().catch(console.error);
