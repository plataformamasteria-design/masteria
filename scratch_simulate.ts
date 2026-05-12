import { db } from './src/lib/db';
import { connections, conversations, contacts, messages } from './src/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { sendUnifiedMessage } from './src/services/unified-message-sender.service';

async function simulateSingleShot() {
    console.log("Simulating Single-Shot Mode Sending...");

    const testContactPhone = '558892161399'; // From user message
    
    // Find contact
    const contactResult = await db.select().from(contacts).where(eq(contacts.phone, testContactPhone)).limit(1);
    const contact = contactResult[0];
    if (!contact) {
        console.error("Contact not found");
        process.exit(1);
    }
    
    console.log("Found Contact:", contact.id);

    // Find conversation
    const conversationResult = await db.query.conversations.findFirst({
        where: eq(conversations.contactId, contact.id),
        with: { connection: true },
        orderBy: [desc(conversations.lastMessageAt)],
    });

    if (!conversationResult) {
        console.error("Conversation not found");
        process.exit(1);
    }

    console.log("Found Conversation:", conversationResult.id);
    console.log("Conversation Connection ID:", conversationResult.connectionId);
    
    let aiConnectionId = conversationResult.connectionId;
    if (!aiConnectionId) {
        console.error("No connection ID in conversation");
        process.exit(1);
    }

    // Resolve provider
    let aiProvider = 'apicloud';
    const resolvedConn = await db.query.connections.findFirst({
        where: eq(connections.id, aiConnectionId)
    });
    
    console.log("Resolved Connection Type:", resolvedConn?.connectionType);

    if (['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')) {
        aiProvider = 'baileys';
    }

    console.log("Resolved AI Provider:", aiProvider);

    if (aiProvider === 'baileys') {
        console.log(`Sending via sendUnifiedMessage to ${testContactPhone} with connectionId ${aiConnectionId}`);
        const sendResult = await sendUnifiedMessage({
            provider: 'baileys',
            connectionId: aiConnectionId,
            to: testContactPhone,
            message: "Teste via simulação Single-Shot",
        });

        console.log("Send Result:", sendResult);
    } else {
        console.log("Provider is apicloud, skipping test");
    }
    
    process.exit(0);
}

simulateSingleShot();
