
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('--- Connection App ID Check ---');
    const activeCons = await db.select().from(connections).where(eq(connections.isActive, true));

    if (activeCons.length === 0) {
        console.log('No active connections.');
        return;
    }

    const appIds = new Set();
    activeCons.forEach(c => {
        console.log(`Connection: ${c.config_name}`);
        console.log(` - ID: ${c.id}`);
        console.log(` - App ID: ${c.appId}`);
        console.log(` - Type: ${c.connectionType}`);
        appIds.add(c.appId);
    });

    console.log(`\nTotal unique App IDs: ${appIds.size}`);
    if (appIds.size > 1) {
        console.log('⚠️ ALERT: Multiple App IDs detected! Webhook validation logic needs to try all secrets.');
    } else {
        console.log('✅ Single App ID detected. Standard validation should work.');
    }
}

main().catch(console.error).finally(() => process.exit(0));
