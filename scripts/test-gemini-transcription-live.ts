
import { transcribeAudioGemini } from '../src/services/gemini-transcription.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Forçar carregamento do .env da raiz
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Sample OGG (silêncio/curto) em Base64
const OGG_BASE64 = 'T2dnUwACAAAAAAAAAAAyzN3NAAAAAGFf2X8BM39GTEFDAQAAAWZMYUMAAAAiEgASAAAAAAAkFQrEQPAAAAAAAAAAAAAAAAAAAAAAAAAAAE9nZ1MAAAAAAAAAAAAAMszdzQEAAAD5LKCSATeEAAAzDQAAAExhdmY1NS40OC4xMDABAAAAGgAAAGVuY29kZXI9TGF2YzU1LjY5LjEwMCBmbGFjT2dnUwAEARIAAAAAAAAyzN3NAgAAAKWVljkCDAD/+GkIAAAdAAABICI=';

async function testTranscription() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE DE TRANSCRIÇÃO GEMINI (EVIDÊNCIA DE IMPLEMENTAÇÃO)      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  if (!process.env.GOOGLE_GEMINI_AGENTS1 && !process.env.GOOGLE_API_KEY) {
    console.error('❌ Nenhuma chave de API do Gemini configurada.');
    process.exit(1);
  }

  try {
    console.log('📦 Preparando áudio de teste (OGG Sample)...');
    const audioBuffer = Buffer.from(OGG_BASE64, 'base64');

    console.log(`📡 Enviando para Gemini (Modelo: gemini-2.0-flash-exp)...`);
    console.log(`   Tamanho do Buffer: ${audioBuffer.length} bytes`);

    const start = Date.now();
    const result = await transcribeAudioGemini(audioBuffer, 'audio/ogg');
    const duration = Date.now() - start;

    console.log('\n✅ RESPOSTA RECEBIDA:');
    console.log('──────────────────────────────────────────────────────────────────');
    console.log(`"${result}"`);
    console.log('──────────────────────────────────────────────────────────────────');
    console.log(`⏱️  Tempo de resposta: ${duration}ms`);

    if (result.includes('Sem fala detectada') || result.trim().length === 0) {
      console.log('\n✅ SUCESSO: A API processou o áudio corretamente (era silêncio).');
    } else {
      console.log('\n✅ SUCESSO: A API retornou uma transcrição.');
    }

  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    if (error.message.includes('API key')) {
      console.log('   (Verifique suas credenciais no .env)');
    }
  }
}

testTranscription();
