/**
 * Centralized ElevenLabs Voice Configuration
 * 
 * This file contains all available voices for the AI agents TTS feature.
 * Voices are organized by language to make it easy for users to find
 * Portuguese-Brazil voices for their agents.
 * 
 * Voice IDs are obtained from the ElevenLabs Voice Library:
 * https://elevenlabs.io/app/voice-library
 */

export interface VoiceOption {
    id: string;
    name: string;
    description: string;
    gender: 'F' | 'M';
    accent?: string;
    useCase?: string;
}

/**
 * Portuguese-Brazil voices from ElevenLabs Voice Library
 * Selected for conversational, sales, and customer service use cases
 */
export const ELEVENLABS_VOICES_PT_BR: VoiceOption[] = [
    // === VOZES FEMININAS PT-BR ===
    {
        id: 'pFZP5JQG7iQjIQuC4Bku', // Scheila - Serious and Direct
        name: 'Scheila',
        description: 'Séria e Direta',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Conversacional'
    },
    {
        id: 'IKne3meq5aSn9XLyUdCD', // Carla - Energetic and Confident (Authority VSL)
        name: 'Carla',
        description: 'Energética e Confiante',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Vendas'
    },
    {
        id: 'jBpfuIE2acCO8z3wKNLl', // Bia - Direct and Assertive
        name: 'Bia',
        description: 'Direta e Assertiva',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Narração'
    },
    {
        id: 'XB0fDUnXU5powFXDhCwa', // Daiane Candido - Calm and Didactic
        name: 'Daiane Candido',
        description: 'Calma e Didática',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Educacional'
    },
    {
        id: 'a0e99841bc75e5p0aXr8', // Gabby - Calming, Smooth and Soft
        name: 'Gabby',
        description: 'Suave e Calma',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Narração'
    },
    {
        id: 'oWAxZDx7w5VEj9dCyTzz', // Juliana Barbieri - Expressive and Warm
        name: 'Juliana Barbieri',
        description: 'Expressiva e Calorosa',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Narração'
    },
    {
        id: 'ThT5KcBeYPX3keUQqHPh', // Aline Mota - Urgent and Firm
        name: 'Aline Mota',
        description: 'Urgente e Firme',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Anúncios'
    },
    {
        id: 'SAz9YHcvj6GT2YYXdXww', // Amandoca - Fun, Breathy and Vibrant
        name: 'Amandoca',
        description: 'Divertida e Vibrante',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Mídia Social'
    },
    {
        id: 'zcAOhNBS3c14rBihAFp1', // Fernanda - Formal and Neutral
        name: 'Fernanda',
        description: 'Formal e Neutra',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Conversacional'
    },
    {
        id: 'z9fAnlkpzviPz146aGWa', // Fernanda AI Agent - Professional and Direct
        name: 'Fernanda AI Agent',
        description: 'Profissional e Direta',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Atendimento'
    },
    {
        id: 'g5CIjZEefAph4nQFvHAz', // Katiuscia - Feminine and Gentle
        name: 'Katiuscia',
        description: 'Feminina e Gentil',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Narração'
    },
    {
        id: 'Xb7hH8MSUJpSbSDYk0k2', // Aninha - Warm, Calm and Soothing
        name: 'Aninha',
        description: 'Calorosa e Calmante',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Narração'
    },
    {
        id: 'pMsXgVXv3BLzUgSXRplE', // Li de Sá - Serious and Confident
        name: 'Li de Sá',
        description: 'Séria e Confiante',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Conversacional'
    },
    {
        id: 'xqSNAlVjOKorKPQGbUeq',
        name: 'Antônio Fogaça',
        description: 'Masculina, Personalizada',
        gender: 'M',
        accent: 'Brasileiro',
        useCase: 'Geral'
    },
    {
        id: 'KHmfNHtEjHhLK9eER20w',
        name: 'Voz Personalizada 2',
        description: 'Voz adicionada (KHmf...)',
        gender: 'F',
        accent: 'Brasileiro',
        useCase: 'Geral'
    },
];

/**
 * English US/UK voices (existing voices for backward compatibility)
 */
export const ELEVENLABS_VOICES_EN: VoiceOption[] = [
    {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Americana, Padrão',
        gender: 'F',
        accent: 'American',
        useCase: 'General'
    },
    {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        description: 'Forte e Autoritária',
        gender: 'F',
        accent: 'American',
        useCase: 'Narration'
    },
    {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        description: 'Suave e Narrativa',
        gender: 'F',
        accent: 'American',
        useCase: 'Narration'
    },
    {
        id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        description: 'Masculina, Padrão',
        gender: 'M',
        accent: 'American',
        useCase: 'General'
    },
    {
        id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli',
        description: 'Jovem e Energética',
        gender: 'F',
        accent: 'American',
        useCase: 'Social'
    },
    {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh',
        description: 'Grave e Profundo',
        gender: 'M',
        accent: 'American',
        useCase: 'Narration'
    },
    {
        id: 'VR6AewLTigWg4xSOukaG',
        name: 'Arnold',
        description: 'Narrador, Épico',
        gender: 'M',
        accent: 'American',
        useCase: 'Narration'
    },
    {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        description: 'Conversacional, Notícias',
        gender: 'M',
        accent: 'American',
        useCase: 'News'
    },
    {
        id: 'yoZ06aMxZJJ28mfd3POQ',
        name: 'Sam',
        description: 'Casual e Amigável',
        gender: 'M',
        accent: 'American',
        useCase: 'Casual'
    },
];

/**
 * Gemini TTS voices (Google's built-in voices)
 */
export const GEMINI_VOICES: VoiceOption[] = [
    { id: 'Aoede', name: 'Aoede', description: 'Feminina, Profissional', gender: 'F' },
    { id: 'Puck', name: 'Puck', description: 'Masculina', gender: 'M' },
    { id: 'Charon', name: 'Charon', description: 'Masculina Profunda', gender: 'M' },
    { id: 'Kore', name: 'Kore', description: 'Feminina Suave', gender: 'F' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Masculina Intensa', gender: 'M' },
];

/**
 * Get all ElevenLabs voices grouped by language
 */
export function getElevenLabsVoicesGrouped() {
    return {
        ptBr: ELEVENLABS_VOICES_PT_BR,
        en: ELEVENLABS_VOICES_EN,
    };
}

/**
 * Get all ElevenLabs voices as a flat array
 */
export function getAllElevenLabsVoices(): VoiceOption[] {
    return [...ELEVENLABS_VOICES_PT_BR, ...ELEVENLABS_VOICES_EN];
}

/**
 * Find a voice by ID
 */
export function findVoiceById(voiceId: string): VoiceOption | undefined {
    return getAllElevenLabsVoices().find(v => v.id === voiceId)
        || GEMINI_VOICES.find(v => v.id === voiceId);
}
