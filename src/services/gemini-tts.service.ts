import { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeCurrencyForTTS } from '@/utils/tts-sanitizer';



import { resolveAIKeys } from '@/lib/ai-keys-resolver';

// Clients cache para cada chave
const genAIClients: Map<string, GoogleGenerativeAI> = new Map();

async function getGeminiClient(companyId?: string, keyIndex: number = 0): Promise<GoogleGenerativeAI> {
  const resolvedKeys = await resolveAIKeys(companyId);
  const companyKey = resolvedKeys.geminiApiKey;

  // Lista de chaves disponíveis (com rotação se for fallback)
  const availableKeys = companyKey 
    ? [companyKey] // Se tiver chave própria, usa apenas a chave própria (sem rotação global)
    : [
        process.env.GOOGLE_GEMINI_AGENTS1,
        process.env.google_api_key_agents1,
        process.env.GOOGLE_API_KEY,
        process.env.GOOGLE_API_KEY_SECONDARY,
        process.env.NEXT_PUBLIC_GEMINI_API_KEY
      ].filter(k => !!k && k.length > 10); // Filtra chaves válidas

  // Remove duplicatas
  const uniqueKeys = [...new Set(availableKeys)];

  if (uniqueKeys.length === 0) {
    console.warn('[Gemini TTS] ❌ Nenhuma chave de API do Gemini configurada.');
    throw new Error('Chave de API do Gemini não configurada (nem no BD nem .env).');
  }

  // Seleciona a chave baseada no índice (rotação)
  const selectedKey = uniqueKeys[keyIndex % uniqueKeys.length] as string;

  if (!genAIClients.has(selectedKey)) {
    console.log(`[Gemini TTS] 🔑 Inicializando cliente Gemini com chave índice ${keyIndex} (termina em ...${selectedKey.slice(-4)})`);
    genAIClients.set(selectedKey, new GoogleGenerativeAI(selectedKey));
  }

  return genAIClients.get(selectedKey)!;
}

/**
 * Gera áudio a partir de texto usando o modelo nativo de TTS do Gemini (2.5 Flash).
 * 
 * @param text O texto para ser falado
 * @param voiceName Nome da voz (Padrão: 'Aoede'). Opções: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'
 * @returns Buffer do áudio (WAV/PCM)
 */
export async function generateAudioFromText(text: string, voiceName: string = 'Aoede', companyId?: string): Promise<Buffer> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 1000;

  console.log(`[Gemini TTS] 📝 Texto original (${text.length} chars): "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

  // Sanitize text - remove emojis and tags that might confuse TTS
  // Keep this minimal to avoid over-sanitization
  const baseSanitizedText = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // transport
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // flags
    .replace(/\[Áudio Gerado pela IA\]/gi, '') // Remove TTS artifact tags
    .replace(/\(áudio falhou\)/gi, '')       // Remove failure tags
    .trim();

  // ✨ SANITIZAÇÃO MONETÁRIA (R$ -> reais)
  // Isso garante que "R$ 89,90" seja lido como "89,90 reais" e não "R cifrão..."
  const sanitizedText = sanitizeCurrencyForTTS(baseSanitizedText);

  console.log(`[Gemini TTS] 🧹 Texto sanitizado (${sanitizedText.length} chars): "${sanitizedText.substring(0, 100)}${sanitizedText.length > 100 ? '...' : ''}"`);

  if (!sanitizedText || sanitizedText.length < 1) {
    console.error('[Gemini TTS] ❌ Texto vazio após sanitização!');
    throw new Error('Texto muito curto ou vazio após sanitização.');
  }

  // Limit text length to avoid issues
  const truncatedText = sanitizedText.slice(0, 4000);

  console.log(`[Gemini TTS] 📝 Gerando áudio para ${truncatedText.length} caracteres...`);

  let lastError: Error | null = null;
  let currentKeyIndex = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Use different key for each attempt (rotation)
      currentKeyIndex = attempt - 1;
      const client = await getGeminiClient(companyId, currentKeyIndex);

      // Modelo validado na investigação: gemini-2.5-flash-preview-tts
      const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-preview-tts' });

      console.log(`[Gemini TTS] 🔄 Tentativa ${attempt}/${MAX_RETRIES} (Key Index: ${currentKeyIndex})...`);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: truncatedText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          }
        } as any // Cast necessário pois speechConfig ainda pode não estar na tipagem padrão da lib
      });

      const response = result.response;

      // Extração do áudio inline
      // A estrutura pode variar, mas na POC validamos: candidate.content.parts[0].inlineData.data
      const candidate = response.candidates?.[0];
      const inlineData = candidate?.content?.parts?.[0]?.inlineData;

      if (inlineData && inlineData.data) {
        const audioBuffer = Buffer.from(inlineData.data, 'base64');
        console.log(`[Gemini TTS] ✅ Áudio gerado com sucesso: ${audioBuffer.length} bytes (tentativa ${attempt})`);
        return audioBuffer;
      }

      // Check if there's a finishReason indicating an issue
      const finishReason = candidate?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        console.warn(`[Gemini TTS] ⚠️ Finish reason: ${finishReason}`);
      }

      // Check for safety ratings or blocks
      const safetyRatings = candidate?.safetyRatings;
      if (safetyRatings) {
        console.warn('[Gemini TTS] Safety ratings:', JSON.stringify(safetyRatings));
      }

      throw new Error(`Nenhum dado de áudio retornado pelo modelo. FinishReason: ${finishReason || 'unknown'}`);

    } catch (error: any) {
      lastError = error;

      console.error(`[Gemini TTS] ❌ Tentativa ${attempt}/${MAX_RETRIES} falhou:`, {
        message: error.message,
        status: error.status || error.code,
        statusText: error.statusText,
        details: error.response?.data || error.errorDetails || 'No details'
      });

      // Don't retry on fatal errors
      if (error.message?.includes('API key') || error.message?.includes('not configured')) {
        throw error;
      }

      // Wait before retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Gemini TTS] ⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Falha ao gerar áudio após todas as tentativas.');
}
