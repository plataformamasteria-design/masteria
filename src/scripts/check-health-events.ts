
import { db } from '../lib/db';
import { metaWebhookHealthEvents } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    console.log('🔍 Checking Meta Webhook Health Events (Failures)...');

    const events = await db.select()
        .from(metaWebhookHealthEvents)
        .orderBy(desc(metaWebhookHealthEvents.validatedAt))
        .limit(10); // Check last 10 events

    if (events.length === 0) {
        console.log('✅ No health events found (clean slate or no traffic).');
    } else {
        events.forEach(e => {
            console.log(`\nTIMESTAMP: ${e.validatedAt}`);
            console.log(`STATUS: ${e.status.toUpperCase()}`);
            console.log(`ERROR: ${e.errorMessage || 'None'}`);
            console.log(`CONN ID: ${e.connectionId}`);
        });
    }
}

main().catch(console.error).finally(() => process.exit(0));
