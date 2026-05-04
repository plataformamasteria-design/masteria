import { generateAudioFromText as generateGeminiAudio } from './gemini-tts.service';
import { generateElevenLabsAudio, ElevenLabsVoiceSettings } from './elevenlabs-tts.service';

export type VoiceProvider = 'gemini' | 'elevenlabs';

interface TTSOptions {
    provider: VoiceProvider;
    voiceId: string;
    settings?: ElevenLabsVoiceSettings;
    companyId?: string;
}

/**
 * Factory function to generate speech using the appropriate provider
 */
export async function generateSpeech(text: string, options: TTSOptions): Promise<Buffer> {
    const { provider, voiceId, settings, companyId } = options;

    console.log(`[TTS Factory] Generating speech using ${provider} (${voiceId})`);

    if (provider === 'elevenlabs') {
        // Map DB camelCase settings to ElevenLabs snake_case
        const mappedSettings: ElevenLabsVoiceSettings = {
            stability: settings?.stability,
            similarity_boost: settings?.similarity_boost ?? (settings as any)?.similarityBoost,
            style: settings?.style,
            use_speaker_boost: settings?.use_speaker_boost ?? (settings as any)?.useSpeakerBoost,
            model_id: settings?.model_id ?? (settings as any)?.modelId,
        };
        return generateElevenLabsAudio(text, voiceId, mappedSettings, companyId);
    }

    // Fallback / Default to Gemini
    // Gemini service uses 'voiceName' which maps to our 'voiceId' here
    return generateGeminiAudio(text, voiceId, companyId);
}
