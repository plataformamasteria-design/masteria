import { db } from '../src/lib/db';
import { conversations } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const c = await db.query.conversations.findFirst({
        where: eq(conversations.id, '541ac40f-8a62-4858-9c37-8979e741f362')
    });
    console.log('AI Active:', c?.aiActive);
    console.log('Agent ID:', c?.voiceAgentId);
}

run().catch(console.error).then(() => process.exit(0));
