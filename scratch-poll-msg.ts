import { db } from './src/lib/db';
import { connections, messages } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { encrypt } from './src/lib/crypto';

async function main() {
    const newToken = 'EAAMNZBpcDzagBRrw54ZB3YuF3TKYhxDOxo1CXYbwJjp99KNY8ZCtf81SPZAr9Wy11VZCGJxz2QABHSll85Udz5t8pHsy3Ua3OjQLPvJq4ZCZCdgjTIuzn7nUcEGPT9MMEjUTP8icQzhrH52d6amRXrfraEvk1lCXBM45iUzgpiuTccL4vfmBqQ0aK1N0bTFWwZDZD';
    
    // Update token
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (conn) {
        await db.update(connections)
            .set({ 
                accessToken: encrypt(newToken),
                status: 'connected',
                isActive: true
            })
            .where(eq(connections.id, conn.id));
    } else {
        return;
    }

    console.log("Polling for new messages on this connection...");
    const startTime = new Date();
    
    for (let i = 0; i < 30; i++) {
        const latestMsgs = await db.query.messages.findMany({
            where: eq(messages.companyId, conn.companyId),
            orderBy: [desc(messages.sentAt)],
            limit: 5,
        });
        
        const newMsg = latestMsgs.find(m => new Date(m.sentAt!) > startTime && m.senderType === 'contact');
        if (newMsg) {
            console.log("\n✅ MENSAGEM RECEBIDA!");
            console.log("Conteudo:", newMsg.content);
            console.log("Tipo:", newMsg.contentType);
            console.log("Hora:", newMsg.sentAt);
            process.exit(0);
        }
        
        // Wait 2 seconds
        await new Promise(r => setTimeout(r, 2000));
        process.stdout.write(".");
    }
    
    console.log("\n❌ Nenhuma mensagem nova recebida no banco de dados.");
}

main().catch(console.error).finally(() => process.exit(0));
