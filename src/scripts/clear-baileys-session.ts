// src/scripts/clear-baileys-session.ts
// Script to clear a conflicting Baileys session from the database
// Usage: npx tsx src/scripts/clear-baileys-session.ts <connectionId>

import { db } from '@/lib/db';
import { baileysAuthState, connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function clearBaileysSession(connectionId?: string) {
    console.log('🔄 Clear Baileys Session Script\n');

    try {
        if (connectionId) {
            // Clear specific connection
            console.log(`Clearing session for connection: ${connectionId}`);

            // Delete auth state
            const result = await db.delete(baileysAuthState)
                .where(eq(baileysAuthState.connectionId, connectionId))
                .returning();

            console.log(`✅ Deleted ${result.length} auth state records`);

            // Update connection status
            await db.update(connections)
                .set({
                    status: 'disconnected',
                    qrCode: null,
                    lastConnected: null
                })
                .where(eq(connections.id, connectionId));

            console.log('✅ Connection status reset to disconnected');

        } else {
            // List all Baileys connections and their status
            console.log('Listing all Baileys connections:\n');

            const baileysConnections = await db.select({
                id: connections.id,
                name: connections.config_name,
                phone: connections.phone,
                status: connections.status,
                connectionType: connections.connectionType,
                lastConnected: connections.lastConnected,
            })
                .from(connections)
                .where(eq(connections.connectionType, 'baileys'));

            if (baileysConnections.length === 0) {
                console.log('No Baileys connections found.');
                return;
            }

            console.log('ID                                   | Name         | Phone         | Status');
            console.log('-'.repeat(90));

            for (const conn of baileysConnections) {
                console.log(`${conn.id} | ${(conn.name || '').padEnd(12)} | ${(conn.phone || '').padEnd(13)} | ${conn.status}`);
            }

            console.log('\nTo clear a specific session, run:');
            console.log('npx tsx src/scripts/clear-baileys-session.ts <connectionId>');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Get connectionId from command line
const connectionId = process.argv[2];

clearBaileysSession(connectionId).then(() => {
    console.log('\n✅ Done');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
