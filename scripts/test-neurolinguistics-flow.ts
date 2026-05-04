
import { db } from '../src/lib/db';
import { contacts, conversations, messages, connections, aiPersonas } from '../src/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '../src/lib/automation-engine';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('🚀 [Test] Starting Neurolinguistic Flow Integration Test...');

  try {
    // 1. SETUP: Find a valid setup (Company + Connection + Persona)
    console.log('[Test] 1. Finding valid environment...');
    
    // Find a company that has connections
    const connection = await db.query.connections.findFirst({
        where: eq(connections.status, 'connected'),
        orderBy: [desc(connections.createdAt)]
    });

    if (!connection) {
        console.error('❌ No connected connection found. Please connect a WhatsApp instance first.');
        process.exit(1);
    }

    const companyId = connection.companyId;
    console.log(`[Test] ✅ Using Company: ${companyId}`);
    console.log(`[Test] ✅ Using Connection: ${connection.id} (${connection.name})`);

    // Ensure connection has an assigned persona or find one to assign
    let personaId = connection.assignedPersonaId;
    if (!personaId) {
        const persona = await db.query.aiPersonas.findFirst({
            where: eq(aiPersonas.companyId, companyId)
        });
        if (persona) {
            personaId = persona.id;
            // Temporarily assign for the test (or just rely on the fallback logic if I force it)
            // Ideally we don't want to modify DB state too much, but automation engine checks connection.assignedPersonaId
            // Let's rely on the engine's fallback or just assume it might work if aiActive is true on conversation
        } else {
             console.warn('⚠️ No Persona found. AI might not trigger, but we can still check the analyzer logs if logic permits.');
        }
    }
    console.log(`[Test] ℹ️ Persona Context: ${personaId || 'None'}`);

    // 2. DEFINE TEST CASES
    const testCases = [
        {
            name: "VISUAL / FAST",
            content: "Eu vejo que isso é claro e brilhante. Mostre-me agora.",
            expectedLog: "VAK=VISUAL"
        },
        {
            name: "KINESTHETIC / SLOW",
            content: "Sinto que precisamos ir com calma, é um processo pesado e difícil de carregar.",
            expectedLog: "VAK=KINESTHETIC"
        },
        {
            name: "NEED: SIGNIFICANCE",
            content: "Eu quero ter sucesso e ser o único a conseguir esse resultado importante.",
            expectedLog: "Need=SIGNIFICANCE"
        }
    ];

    // 3. EXECUTE LOOP
    for (const test of testCases) {
        console.log(`\n---------------------------------------------------`);
        console.log(`[Test Case] Executing: ${test.name}`);
        console.log(`[Test Case] Message: "${test.content}"`);

        // Create/Get Contact
        const phone = '5511999999999'; // Test number
        let contact = await db.query.contacts.findFirst({
            where: and(eq(contacts.phone, phone), eq(contacts.companyId, companyId))
        });

        if (!contact) {
            [contact] = await db.insert(contacts).values({
                companyId,
                name: 'Neurolinguistic Test User',
                phone: phone,
                isGroup: false
            }).returning();
        }

        // Create/Get Conversation
        let conversation = await db.query.conversations.findFirst({
            where: and(eq(conversations.contactId, contact.id), eq(conversations.connectionId, connection.id))
        });

        if (!conversation) {
            [conversation] = await db.insert(conversations).values({
                companyId,
                contactId: contact.id,
                connectionId: connection.id,
                status: 'open',
                aiActive: true, // Force AI active
                assignedPersonaId: personaId // Assign persona if available
            }).returning();
        } else {
            // Ensure AI is active for the test
             await db.update(conversations)
                .set({ aiActive: true, assignedPersonaId: personaId })
                .where(eq(conversations.id, conversation.id));
        }

        // Insert Message
        const messageId = uuidv4();
        const [msg] = await db.insert(messages).values({
            companyId,
            conversationId: conversation.id,
            senderType: 'USER',
            content: test.content,
            contentType: 'text',
            status: 'received',
            providerMessageId: `TEST_${Date.now()}_${Math.random()}`,
            sentAt: new Date()
        }).returning();

        console.log(`[Test] Message inserted: ${msg.id}`);

        // Trigger Automation
        console.log(`[Test] Triggering Automation Engine... (Waiting 4s debounce internally)`);
        
        // We can't easily wait for the logs here since they are async and printed to stdout.
        // But running this in the terminal will show the logs mixed with our output.
        // We will call the function and catch errors.
        
        try {
            await processIncomingMessageTrigger(conversation.id, msg.id, { dryRunSend: true });
            console.log(`[Test] ✅ Trigger call completed.`);
        } catch (e) {
            console.error(`[Test] ❌ Trigger failed:`, e);
        }

        // Wait a bit before next test to avoid overlapping logs too much
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n[Test] All cases executed. Check the console output above for "🧠 Análise Neurolinguística" logs.');

  } catch (error) {
    console.error('[Test] Critical Error:', error);
  }
  process.exit(0);
}

main();
