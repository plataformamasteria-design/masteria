import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env' });

import fs from 'fs';
import path from 'path';

async function main() {
    const { db } = await import('./src/lib/db');
    const { connections } = await import('./src/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { evolutionApiService } = await import('./src/services/evolution-api.service');

    console.log('🔄 Iniciando teste de mídia API Não Oficial com arquivos REAIS...');
    
    // Configurações do Teste
    const CONNECTION_NAME = 'Bruno Macedo';
    const TARGET_NUMBER = '5588920008007';
    
    const [connection] = await db.select().from(connections)
        .where(eq(connections.config_name, CONNECTION_NAME))
        .limit(1);

    if (!connection) return console.error(`❌ Conexão não encontrada!`);
    const instanceName = connection.sessionName || connection.id;
    console.log(`✅ Conexão encontrada! Instance Name: ${instanceName}`);
    
    const tempDir = path.join(process.cwd(), '.temp_media_real');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    // 1. Download real áudio (MP3)
    console.log('Baixando áudio real...');
    const audioRes = await fetch('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    
    // 2. Download real video (MP4)
    console.log('Baixando vídeo real...');
    const videoRes = await fetch('https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // 3. Teste: AUDIO REAL
    console.log('\n🎙️ Enviando AUDIO (Voice Note/Audio Real)...');
    try {
        const base64Audio = audioBuffer.toString('base64');
        const resAudio = await evolutionApiService.sendMedia(
            instanceName,
            TARGET_NUMBER,
            'audio',
            base64Audio,
            undefined,
            'beep.ogg',
            'audio/ogg'
        );
        console.log('✅ Áudio enviado com sucesso!', resAudio?.key?.id || resAudio);
    } catch (error: any) {
        console.error('❌ Erro no envio de Áudio:', error.message || error);
    }

    // 4. Teste: VIDEO REAL
    console.log('\n🎥 Enviando VIDEO...');
    try {
        const base64Video = videoBuffer.toString('base64');
        const resVideo = await evolutionApiService.sendMedia(
            instanceName,
            TARGET_NUMBER,
            'video',
            base64Video,
            'Vídeo de Teste Master IA',
            'video.mp4',
            'video/mp4'
        );
        console.log('✅ Vídeo enviado com sucesso!', resVideo?.key?.id || resVideo);
    } catch (error: any) {
        console.error('❌ Erro no envio de Vídeo:', error.message || error);
    }

    console.log('\n🏁 Testes finalizados!');
    process.exit(0);
}

main().catch(console.error);
