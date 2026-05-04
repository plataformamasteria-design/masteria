
import { tokenRefreshService } from '../services/token-refresh.service';
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const connectionId = 'c025e687-29eb-4589-b257-13c1349db630';
    console.log(`Attempting refresh for: ${connectionId}`);

    try {
        await tokenRefreshService.refreshConnectionToken(connectionId);
        console.log('Refresh Service executed successfully.');

        // Setup success check
        const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
        if (!conn) {
            console.log('Connection not found after refresh attempt.');
            return;
        }
        console.log(`New Token Expiry: ${conn.tokenExpiresAt}`);
        console.log(`Last Refreshed: ${conn.tokenLastRefreshed}`);

    } catch (error) {
        console.error('Refresh FAILED:', error);
    }
}

main().catch(console.error).finally(() => process.exit(0));
