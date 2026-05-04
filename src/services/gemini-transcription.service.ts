
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

async function getGeminiClient(companyId?: string): Promise<GoogleGenerativeAI> {
  const resolvedKeys = await resolveAIKeys(companyId);
  const GEMINI_API_KEY = resolvedKeys.geminiApiKey;

  if (!GEMINI_API_KEY) {
    console.warn('[Gemini Transcription] Nenhuma chave de API do Gemini configurada.');
    throw new Error('Chave de API do Gemini não configurada.');
  }

  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

/**
 * Transcreve áudio usando a capacidade multimodal nativa do Google Gemini.
 * O modelo 1.5 Flash é ideal para isso por ser rápido, barato e multimodais.
 * 
 * @param audioBuffer Buffer do arquivo de áudio (suporta OGG, MP3, WAV, etc.)
 * @param mimeType Tipo MIME do áudio (ex: 'audio/ogg')
 * @returns Texto transcrito
 */

export async function transcribeAudioGemini(audioBuffer: Buffer, mimeType: string = 'audio/ogg', companyId?: string): Promise<string> {
  const client = await getGeminiClient(companyId);
  let audioBase64: string | null = audioBuffer.toString('base64');

  const generate = async (modelName: string) => {
    console.log(`[Gemini Transcription] Tentando modelo: ${modelName}...`);
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      },
      { text: "Transcreva este áudio exatamente como foi falado. Se houver silêncio ou apenas ruído, responda apenas '[Sem fala detectada]'. Não adicione comentários, apenas a transcrição." }
    ]);
    const response = await result.response;
    const text = response.text().trim();
    console.log(`[Gemini Transcription] ✅ Transcrição concluída: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    (audioBase64 as any) = null; // ✅ Liberar string base64 da memória
    return text;
  };

  try {
    // Tentar modelo estável 2.0 primeiro
    return await generate('gemini-2.0-flash');
  } catch (error: any) {
    console.warn(`[Gemini Transcription] Falha com gemini-2.0-flash: ${error.message}. Tentando fallback...`);
    try {
      // Fallback para modelo estável 1.5 (usando nome completo para evitar 404)
      return await generate('gemini-1.5-flash-latest');
    } catch (fallbackError: any) {
      console.error('[Gemini Transcription] Erro fatal na transcrição:', fallbackError);
      throw new Error(`Falha na transcrição com Gemini (todos os modelos): ${fallbackError.message}`);
    }
  }
}

