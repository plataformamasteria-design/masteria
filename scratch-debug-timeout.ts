import { db } from './src/lib/db/index';
import { contacts, conversations, messages, connections, automationFlowExecutions } from './src/lib/db/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function debugTimeout() {
    console.log('--- Buscando Contatos ---');
    const contactList = await db.select().from(contacts).where(or(
        ilike(contacts.phone, '%920008007%'),
        ilike(contacts.phone, '%92161399%')
    ));
    
    for (const c of contactList) {
        console.log(`\nContato: ${c.name} (Phone: ${c.phone}, ID: ${c.id})`);
        
        const convs = await db.select().from(conversations).where(eq(conversations.contactId, c.id));
        console.log(`  Conversas encontradas: ${convs.length}`);
        
        for (const conv of convs) {
            let connName = 'N/A';
            if (conv.connectionId) {
                const connList = await db.select().from(connections).where(eq(connections.id, conv.connectionId));
                if (connList.length > 0) connName = connList[0].config_name;
            }
            console.log(`    Conv ID: ${conv.id} | Connection: ${connName} (${conv.connectionId}) | Status: ${conv.status} | LastMsg: ${conv.lastMessageAt}`);
            
            const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
            console.log(`      Mensagens: ${msgs.length}`);
            // Show last 3 messages
            const lastMsgs = msgs.slice(-3);
            for (const msg of lastMsgs) {
                console.log(`        [${msg.sentAt}] ${msg.senderType}: ${msg.content?.substring(0, 50)} (Connection: ${msg.connectionId})`);
            }
        }

        const execs = await db.select().from(automationFlowExecutions).where(eq(automationFlowExecutions.contactId, c.id));
        console.log(`  Execuções de Automação: ${execs.length}`);
        for (const ex of execs) {
            console.log(`    Exec ID: ${ex.id} | Status: ${ex.status} | Started: ${ex.startedAt} | Current Step: ${ex.currentStepId}`);
        }
    }
}

debugTimeout().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
