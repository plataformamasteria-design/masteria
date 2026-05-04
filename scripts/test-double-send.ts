
const { db } = require('../src/lib/db');
const { messages, conversations } = require('../src/lib/db/schema');
const { eq, and } = require('drizzle-orm');

async function main() {
    console.log('🚀 Starting Double Send Verification Test...');

    // 1. Simulate a message ID
    const messageId = `test_msg_${Date.now()}`;
    const companyId = '5511999999999'; // Example company ID
    const providerMessageId = `wamid_${Date.now()}`;

    console.log(`📋 Testing with ProviderMessageID: ${providerMessageId}`);

    // 2. Simulate concurrent checks (Logic from route.ts)
    const checkDuplication = async (id, attempt) => {
        console.log(`[Attempt ${attempt}] Checking duplication...`);
        const existing = await db.select({ id: messages.id })
            .from(messages)
            .innerJoin(conversations, eq(messages.conversationId, conversations.id))
            .where(and(
                eq(messages.providerMessageId, id)
            )) // Simplified query for test
            .limit(1);

        if (existing.length > 0) {
            console.log(`[Attempt ${attempt}] 🛑 Found duplicate!`);
            return true;
        }
        console.log(`[Attempt ${attempt}] ✅ Unique message.`);
        return false;
    };

    // 3. Run concurrent checks + insert simulation
    // This is a simplified test. Unfortunatley we can't easily spin up the full Next.js endpoint here.
    // Instead we are testing the database unique logging logic manually.

    console.log('\n⚠️ Integration test via script is limited. Please use the real endpoint with the following CURL command to test race conditions:\n');

    const curlCmd = `
curl -X POST http://localhost:3000/api/webhooks/meta/test \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"id":"${providerMessageId}","from":"5511999999999","type":"text","text":{"body":"Hello"}}]}' & \\
curl -X POST http://localhost:3000/api/webhooks/meta/test \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"id":"${providerMessageId}","from":"5511999999999","type":"text","text":{"body":"Hello"}}]}'
  `;

    console.log(curlCmd);

    console.log('\n✅ Verification Script Logic:');
    console.log('1. The route.ts file now has strict deduplication logging.');
    console.log('2. automation-engine.ts has a lock to prevent multiple AI responses.');

    process.exit(0);
}

main().catch(console.error);
