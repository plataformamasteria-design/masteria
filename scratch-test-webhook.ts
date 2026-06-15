import { db } from './src/lib/db';
import { connections, companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';

async function main() {
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (conn) {
        const company = await db.query.companies.findFirst({
            where: eq(companies.id, conn.companyId)
        });

        const appSecret = decrypt(conn.appSecret);
        
        // get app access token
        const url = `https://graph.facebook.com/oauth/access_token?client_id=${conn.appId}&client_secret=${appSecret}&grant_type=client_credentials`;
        const response = await fetch(url);
        const data = await response.json();
        
        const appAccessToken = data.access_token;
        
        const subUrl = `https://graph.facebook.com/v21.0/${conn.appId}/subscriptions?access_token=${appAccessToken}&fields=object,callback_url,subscribed_fields`;
        const subRes = await fetch(subUrl);
        const subData = await subRes.json();
        
        console.log("Subscriptions:", JSON.stringify(subData, null, 2));
        
        const expectedUrl = `https://masteria.app/api/webhooks/meta/${company?.webhookSlug}`;
        console.log("Expected URL:", expectedUrl);
    }
}

main().catch(console.error).finally(() => process.exit(0));
