import { generateElevenLabsAudio } from '../services/elevenlabs-tts.service';
import * as dotenv from 'dotenv';
dotenv.config();

const invoiceId = 'KHmfNHtEjHhLK9eER20w';

async function testVoice() {
    console.log(`Testing Voice ID: ${invoiceId}`);
    try {
        const audio = await generateElevenLabsAudio('Olá, este é um teste de voz.', invoiceId, {
            model_id: 'eleven_multilingual_v2', // Usar v2 para teste seguro
            stability: 0.5,
            similarity_boost: 0.75
        });
        console.log('✅ SUCESSO! A voz está disponível e gerou áudio.');
        console.log(`Tamanho do buffer: ${audio.length} bytes`);
    } catch (error: any) {
        console.error('❌ ERRO AO TESTAR VOZ:');
        console.error(error.message);
        if (error.message.includes('voice_not_found')) {
            console.error('\n--> DIAGNÓSTICO: A voz NÃO foi encontrada na sua conta SevenLabs. Você precisa adicioná-la ao VoiceLab primeiro.');
        }
    }
}

testVoice();
