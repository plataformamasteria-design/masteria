
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';

async function main() {
    const connectionId = 'c025e687-29eb-4589-b257-13c1349db630';
    console.log(`Debugging connection: ${connectionId}`);

    const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));

    if (!conn) {
        console.error('Connection not found in DB.');
        return;
    }

    console.log(`Connection found: ${conn.config_name}`);
    console.log(`Type: ${conn.connectionType}`);
    console.log(`Phone ID: ${conn.phoneNumberId}`);
    // console.log(`Active: ${conn.isActive}`);

    if (!conn.accessToken) {
        console.error('No access token in DB.');
        return;
    }

    let accessToken;
    try {
        accessToken = decrypt(conn.accessToken);
        console.log('Token decrypted successfully.');
    } catch (error) {
        console.error('Failed to decrypt token:', error);
        return;
    }

    if (!accessToken) {
        console.error('Decrypted valid token is empty.');
        return;
    }

    console.log('Testing Meta API...');
    // Using v21.0 or whatever version is stable, action uses v24.0 but maybe that's too new?
    // Actions.ts uses v24.0. Let's stick to v24.0 to match logic.
    const url = `https://graph.facebook.com/v24.0/${conn.phoneNumberId}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        console.log(`API Status: ${response.status} ${response.statusText}`);
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            console.error('API Check FAILED.');
        } else {
            console.log('API Check SUCCESS.');
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main().catch(console.error).finally(() => process.exit(0));
