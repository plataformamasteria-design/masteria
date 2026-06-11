import 'dotenv/config';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

const TARGET_NUMBER = '5588920008007';
const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

async function sendTextMessage(phoneNumberId: string, accessToken: string) {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${phoneNumberId}/messages`;
    const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: TARGET_NUMBER,
        type: 'text',
        text: { body: 'Teste de mensagem de texto via API Oficial (Diagnosticando Token).' }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    const data = await res.json();
    console.log(`Status HTTP: ${res.status}`);
    console.log(`Resposta da Meta:`, JSON.stringify(data, null, 2));
}

async function main() {
    const conns = await db.select().from(connections).where(eq(connections.config_name, '8276_Antônio_BM_GRUP_ED'));
    const validConn = conns[0];
    
    if (!validConn || !validConn.accessToken || !validConn.phoneNumberId) {
        console.error('Conexão 8276_Antônio_BM_GRUP_ED não encontrada ou sem token/phoneId.');
        return;
    }
    
    const token = validConn.accessToken;
    const phoneId = validConn.phoneNumberId;
    console.log(`Testando envio de TEXTO pela conexão: ${validConn.config_name} (PhoneId: ${phoneId})`);
    
    await sendTextMessage(phoneId, token);
}

main().catch(console.error);
