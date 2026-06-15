import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

async function sendMetaMessage(phoneNumberId: string, accessToken: string, toPhone: string, text: string) {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${phoneNumberId}/messages`;
    
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "text",
        text: {
            preview_url: false,
            body: text
        }
    };
    
    console.log(`\n📤 Sending to: ${toPhone}`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error sending:", e);
    }
}

async function main() {
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (!conn) {
        console.log("Connection not found!");
        return;
    }
    
    const token = decrypt(conn.accessToken);
    
    console.log("Testing message sending...");
    
    // Test without the 9 (8 digits)
    await sendMetaMessage(conn.phoneNumberId!, token, "5588920008007", "Teste de envio de mensagem SEM o 9 extra. Favor ignorar.");
    
    // Test with the 9 (9 digits)
    await sendMetaMessage(conn.phoneNumberId!, token, "55889920008007", "Teste de envio de mensagem COM o 9 extra. Favor ignorar.");
}

main().catch(console.error).finally(() => process.exit(0));
