import 'dotenv/config';
import { db } from "@/lib/db";
import { messages, conversations, metaWebhookHealthEvents } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function check() {
    console.log("🔍 Checking latest messages...");
    const recentMessages = await db.select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.sentAt,
        senderType: messages.senderType,
        conversationId: conversations.id,
        source: conversations.source
    })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .orderBy(desc(messages.sentAt))
        .limit(5);

    console.log("Recent Messages:", JSON.stringify(recentMessages, null, 2));

    console.log("\n🔍 Checking Webhook Health Events...");
    const healthEvents = await db.select()
        .from(metaWebhookHealthEvents)
        .orderBy(desc(metaWebhookHealthEvents.validatedAt))
        .limit(5);

    console.log("Recent Health Events:", JSON.stringify(healthEvents, null, 2));
    process.exit(0);
}

check().catch(console.error);
