import 'dotenv/config';
import fs from 'fs';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadMediaToMeta } from './src/lib/metaMediaUpload';
import { decrypt } from './src/lib/crypto';

const TARGET_NUMBER = '5588920008007';
const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

async function sendMediaMessage(phoneNumberId: string, accessToken: string, type: string, mediaId: string) {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${phoneNumberId}/messages`;
    const body: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: TARGET_NUMBER,
        type: type,
    };
    body[type] = { id: mediaId };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        console.error(`Erro ao enviar ${type}:`, JSON.stringify(data, null, 2));
        throw new Error('Send failed');
    } else {
        console.log(`Sucesso ao enviar ${type}:`, data.messages?.[0]?.id);
    }
}

async function main() {
    const conns = await db.select().from(connections).where(eq(connections.config_name, '8276_Antônio_BM_GRUP_ED'));
    const targetConn = conns[0];
    
    if (!targetConn || !targetConn.accessToken) return;

    const token = decrypt(targetConn.accessToken);
    const phoneId = targetConn.phoneNumberId!;
    console.log(`\n\n=== Re-testando Audio M4A/AAC para: ${targetConn.config_name} ===`);

    try {
        console.log('\n--- Testando Audio AAC (.m4a) ---');
        // Lê o arquivo gerado via FFmpeg
        const aacBuf = fs.readFileSync('./test_audio.m4a');
        
        // WhatsApp aceita audio/mp4 contendo AAC
        const audioId = await uploadMediaToMeta(phoneId, token, aacBuf, 'audio/mp4', 'music.m4a');
        await sendMediaMessage(phoneId, token, 'audio', audioId);

        console.log(`\n✅ Áudio (M4A/AAC) reenviado!`);
    } catch (error) {
        console.error(`Falha:`, error);
    }
}

main().catch(console.error);
