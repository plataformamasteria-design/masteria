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
    const { convertToOgg } = await import('./src/lib/ffmpeg');

    console.log('🔄 Iniciando teste de mídia API Não Oficial (Evolution/Baileys)...');
    
    // Configurações do Teste
    const CONNECTION_NAME = 'Bruno Macedo'; // Procurando pela conexão Bruno
    const TARGET_NUMBER = '5588920008007'; // Número do Deivid
    
    // 1. Encontrar a conexão
    console.log(`🔍 Buscando conexão: ${CONNECTION_NAME}...`);
    const [connection] = await db.select().from(connections)
        .where(eq(connections.config_name, CONNECTION_NAME))
        .limit(1);

    if (!connection) {
        console.error(`❌ Conexão "${CONNECTION_NAME}" não encontrada!`);
        process.exit(1);
    }
    
    if (connection.connectionType !== 'baileys' && connection.connectionType !== 'evolution') {
        console.error(`❌ Conexão "${CONNECTION_NAME}" não é do tipo Evolution/Baileys (${connection.connectionType}).`);
        process.exit(1);
    }

    const instanceName = connection.sessionName || connection.id;
    console.log(`✅ Conexão encontrada! Instance Name: ${instanceName}`);
    
    // 2. Preparar arquivos de teste
    const tempDir = path.join(process.cwd(), '.temp_media_unofficial');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    // Gerar Imagem de Teste (PNG pixel transparente 1x1)
    const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082';
    const imagePath = path.join(tempDir, 'test_image.png');
    fs.writeFileSync(imagePath, Buffer.from(pngHex, 'hex'));

    // Gerar Áudio (Pequeno beep PCM convertido para OGG)
    console.log(`🎵 Gerando arquivo de áudio de teste (via FFmpeg)...`);
    // 20 bytes dummy RIFF para forçar o conversor a gerar um som mudo mínimo
    const pcmDummy = Buffer.alloc(10000); 
    let audioBuffer;
    try {
        audioBuffer = await convertToOgg(pcmDummy);
    } catch (e) {
        console.error('Falha ao gerar ogg localmente, testando envio de base64 cru de arquivo vazio');
        audioBuffer = Buffer.alloc(10);
    }
    const audioPath = path.join(tempDir, 'test_audio.ogg');
    fs.writeFileSync(audioPath, audioBuffer);
    
    // 3. Teste 1: IMAGEM
    console.log('\n📸 Teste 1: Enviando IMAGEM...');
    try {
        const base64Image = fs.readFileSync(imagePath).toString('base64');
        const resImage = await evolutionApiService.sendMedia(
            instanceName,
            TARGET_NUMBER,
            'image',
            base64Image,
            'Imagem de Teste - API Não Oficial',
            'test_image.png',
            'image/png'
        );
        console.log('✅ Imagem enviada com sucesso!', resImage?.key?.id || resImage);
    } catch (error: any) {
        console.error('❌ Erro no envio de Imagem:', error.message || error);
    }

    // 4. Teste 2: DOCUMENTO
    console.log('\n📄 Teste 2: Enviando DOCUMENTO (PDF fictício)...');
    try {
        const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
        const base64Doc = dummyPdf.toString('base64');
        const resDoc = await evolutionApiService.sendMedia(
            instanceName,
            TARGET_NUMBER,
            'document',
            base64Doc,
            undefined,
            'documento_teste.pdf',
            'application/pdf'
        );
        console.log('✅ Documento enviado com sucesso!', resDoc?.key?.id || resDoc);
    } catch (error: any) {
        console.error('❌ Erro no envio de Documento:', error.message || error);
    }

    // 5. Teste 3: AUDIO (Mensagem de Voz)
    console.log('\n🎙️ Teste 3: Enviando AUDIO (Voice Note)...');
    try {
        const base64Audio = fs.readFileSync(audioPath).toString('base64');
        const resAudio = await evolutionApiService.sendMedia(
            instanceName,
            TARGET_NUMBER,
            'audio',
            base64Audio,
            undefined,
            'audio_teste.ogg',
            'audio/ogg'
        );
        console.log('✅ Áudio enviado com sucesso!', resAudio?.key?.id || resAudio);
    } catch (error: any) {
        console.error('❌ Erro no envio de Áudio:', error.message || error);
    }

    console.log('\n🏁 Testes finalizados!');
    process.exit(0);
}

main().catch(console.error);
