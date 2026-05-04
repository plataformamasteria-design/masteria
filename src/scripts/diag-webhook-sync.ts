
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { like } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';

async function main() {
    console.log('--- Meta Credentials Diagnosis ---');

    const [conn] = await db.select().from(connections).where(like(connections.config_name, '1033_%')).limit(1);

    if (!conn) {
        console.error('Connection "1033_" not found.');
        return;
    }

    console.log(`Connection ID: ${conn.id}`);
    console.log(`Config Name: ${conn.config_name}`);
    console.log(`App ID: ${conn.appId}`);

    if (!conn.appSecret) {
        console.error('App Secret is missing in DB.');
        return;
    }

    const appSecret = decrypt(conn.appSecret);
    console.log(`App Secret (Decrypted): ${appSecret.substring(0, 4)}...${appSecret.substring(appSecret.length - 4)}`);

    const url = `https://graph.facebook.com/oauth/access_token?client_id=${conn.appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    console.log('Attempting to fetch App Access Token from Meta...');

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Meta API Error:', data.error);
        } else {
            console.log('✅ App Access Token obtained successfully.');
            // console.log(`Token: ${data.access_token.substring(0, 10)}...`);
        }
    } catch (e) {
        console.error('❌ Network Error:', e);
    }
}

main().catch(console.error).finally(() => process.exit(0));
