
import { db } from '@/lib/db';
import { connections, conversations, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function verifyInstagramEvents() {
    console.log("🔍 Verifying Instagram Events...");

    // 1. Check Connections
    console.log("\n📡 Checking Instagram Connections...");
    const instagramConnections = await db
        .select()
        .from(connections)
        .where(eq(connections.connectionType, 'instagram'));

    if (instagramConnections.length === 0) {
        console.log("❌ No Instagram connections found.");
    } else {
        console.log(`✅ Found ${instagramConnections.length} Instagram connections.`);
        instagramConnections.forEach(conn => {
            console.log(`   - [${conn.id}] ${conn.config_name} (WABA/Page ID: ${conn.wabaId}, Phone/IG ID: ${conn.phoneNumberId})`);
        });
    }

    // 2. Check Conversations
    console.log("\n💬 Checking Instagram Conversations...");
    const instagramConversations = await db
        .select()
        .from(conversations)
        .where(eq(conversations.source, 'instagram'));

    if (instagramConversations.length === 0) {
        console.log("❌ No Instagram conversations found.");
    } else {
        console.log(`✅ Found ${instagramConversations.length} Instagram conversations.`);
    }

    // 3. Check Messages for these conversations
    for (const conv of instagramConversations) {
        console.log(`\n   📂 Conversation [${conv.id}] with Contact [${conv.contactId}]:`);
        const convMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conv.id))
            .orderBy(desc(messages.sentAt))
            .limit(10); // Check last 10 messages

        if (convMessages.length === 0) {
            console.log("      (No messages found)");
        } else {
            convMessages.forEach(msg => {
                const direction = msg.senderType === 'contact' ? '📥 RECEIVED' : '📤 SENT';
                console.log(`      ${direction} [${msg.sentAt?.toISOString()}]: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
            });
        }
    }

    console.log("\n🏁 Verification Complete.");
}

verifyInstagramEvents().catch(console.error);
