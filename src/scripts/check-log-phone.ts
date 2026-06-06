
import { db } from '../lib/db';
import { webhookLogs } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

const PHONE = '556237718272';

async function main() {
    console.log(`🔍 Searching logs (JS Filter) for phone: ${PHONE}...`);

    // Fetch last 50 logs and filter in memory
    const logs = await db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(50);

    const matches = logs.filter(l => JSON.stringify(l.payload).includes(PHONE));

    if (matches.length === 0) {
        console.log('❌ No logs matching this phone.');
    } else {
        console.log(`✅ Found ${matches.length} matches:`);
        matches.forEach(l => {
            console.log(`\n📅 [${l.createdAt}]`);
            console.log(JSON.stringify(l.payload).substring(0, 200) + '...');
        });
    }

    console.log('\n--- Checking System Health ---');
    try {
        const res = await fetch('https://masteria.app/api/health');
        console.log(`Localhost Ping: ${res.status}`);
    } catch (e) {
        console.log('Localhost Ping: FAILED (Server might be sleeping or broken)');
    }
}

main().catch(console.error).finally(() => process.exit(0));
