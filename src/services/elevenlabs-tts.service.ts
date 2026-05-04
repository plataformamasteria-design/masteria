
import { sanitizeCurrencyForTTS } from '@/utils/tts-sanitizer';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsVoiceSettings {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    model_id?: string;
}

/**
 * Generate audio using ElevenLabs TTS API
 * @param text Text to convert to speech
 * @param voiceId ElevenLabs Voice ID
 * @param settings Optional voice settings (stability, similarity_boost, etc)
 * @returns Audio buffer
 */
export async function generateElevenLabsAudio(
    text: string,
    voiceId: string,
    settings?: ElevenLabsVoiceSettings,
    companyId?: string
): Promise<Buffer> {
    const resolvedKeys = await resolveAIKeys(companyId);
    const apiKey = resolvedKeys.elevenlabsApiKey;

    if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
    }

    // Set default settings if not provided
    // Set default settings if not provided
    let stability = settings?.stability ?? 0.5;

    // 🩹 V3 FIX: Eleven v3 requires strict stability values: [0.0, 0.5, 1.0]
    if (settings?.model_id === 'eleven_v3') {
        if (stability < 0.25) stability = 0.0;
        else if (stability > 0.75) stability = 1.0;
        else stability = 0.5;
    }

    const voiceSettings = {
        stability: stability,
        similarity_boost: settings?.similarity_boost ?? 0.75,
        style: settings?.style ?? 0,
        use_speaker_boost: settings?.use_speaker_boost ?? true,
    };

    // ✨ SANITIZAÇÃO MONETÁRIA (R$ -> reais) e SSML (se v3)
    // Isso garante que "R$ 89,90" seja lido como "89,90 reais"
    // e remove tags <break> se o modelo for v3
    const sanitizedText = sanitizeCurrencyForTTS(text, { modelId: settings?.model_id });

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey,
            },
            body: JSON.stringify({
                text: sanitizedText,
                model_id: settings?.model_id || 'eleven_multilingual_v2', // Use versatile model by default
                voice_settings: voiceSettings,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Enriquecer mensagem de erro para quota_exceeded
            const detail = errorData?.detail;
            if (detail?.status === 'quota_exceeded') {
                const msg = detail.message || 'Quota exceeded';
                console.error(`[ElevenLabs TTS] ⚠️ Quota esgotada: ${msg}`);
                throw new Error(`ElevenLabs quota_exceeded: ${msg}`);
            }
            throw new Error(`ElevenLabs API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error: any) {
        console.error('[ElevenLabs TTS] Generation failed:', error);
        throw error;
    }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getElevenLabsVoices() {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_audio_voz_agent_apikey;
    if (!apiKey) return [];

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
            method: 'GET',
            headers: {
                'xi-api-key': apiKey,
            },
        });

        if (!response.ok) return [];

        const data = await response.json();
        return data.voices || [];
    } catch (error) {
        console.error('[ElevenLabs TTS] Failed to fetch voices:', error);
        return [];
    }
}
