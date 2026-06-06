import { OpenAI, toFile } from 'openai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

async function getOpenAIClient(companyId?: string, overrideApiKey?: string): Promise<OpenAI> {
  let OPENAI_API_KEY = overrideApiKey;
  
  if (!OPENAI_API_KEY) {
    const resolvedKeys = await resolveAIKeys(companyId);
    OPENAI_API_KEY = resolvedKeys.openaiApiKey;
  }

  if (!OPENAI_API_KEY) {
    console.warn('[OpenAI Transcription] Nenhuma chave de API da OpenAI configurada.');
    throw new Error('Chave de API da OpenAI não configurada.');
  }

  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

/**
 * Transcreve áudio usando a API Whisper da OpenAI.
 * 
 * @param audioBuffer Buffer do arquivo de áudio (suporta OGG, MP3, WAV, etc.)
 * @param mimeType Tipo MIME do áudio (ex: 'audio/ogg')
 * @returns Texto transcrito
 */
export async function transcribeAudioOpenAI(audioBuffer: Buffer, mimeType: string = 'audio/ogg', companyId?: string, overrideApiKey?: string): Promise<string> {
  const client = await getOpenAIClient(companyId, overrideApiKey);
  
  // O Whisper precisa de um nome de arquivo com a extensão correta para inferir o formato
  let extension = 'ogg';
  if (mimeType.includes('mp4')) extension = 'mp4';
  else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) extension = 'mp3';
  else if (mimeType.includes('wav')) extension = 'wav';
  else if (mimeType.includes('webm')) extension = 'webm';
  else if (mimeType.includes('m4a')) extension = 'm4a';
  
  const fileName = `audio.${extension}`;

  console.log(`[OpenAI Transcription] Tentando transcrever áudio via Whisper... (${fileName})`);
  
  try {
    const file = await toFile(audioBuffer, fileName, { type: mimeType });
    const response = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text', // Retorna apenas o texto diretamente
    });
    
    const text = (response as any as string).trim();
    console.log(`[OpenAI Transcription] ✅ Transcrição concluída: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    return text;
  } catch (error: any) {
    console.error('[OpenAI Transcription] Erro fatal na transcrição:', error);
    throw new Error(`Falha na transcrição com OpenAI (Whisper): ${error.message}`);
  }
}
