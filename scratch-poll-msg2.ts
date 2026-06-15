import { db } from './src/lib/db';
import { connections, messages } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (conn) {
        const latestMsgs = await db.query.messages.findMany({
            where: eq(messages.companyId, conn.companyId),
            orderBy: [desc(messages.sentAt)],
            limit: 3,
        });
        
        console.log("Ultimas mensagens da empresa:", latestMsgs.map(m => ({
            id: m.id,
            content: m.content,
            sentAt: m.sentAt,
            senderType: m.senderType
        })));
    }
}

main().catch(console.error).finally(() => process.exit(0));
