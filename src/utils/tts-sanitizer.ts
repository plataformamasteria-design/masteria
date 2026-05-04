/**
 * Utilitário para sanitização de texto especificamente para Text-to-Speech (TTS).
 * O objetivo é transformar símbolos que o TTS lê literalmente (como "R cifrão")
 * em texto natural falado (como "reais").
 */

export function sanitizeCurrencyForTTS(text: string, options?: { modelId?: string }): string {
    if (!text) return text;

    let sanitized = text;

    // --- 0. SSML Splitting (Specific for ElevenLabs v2.5 Turbo/Flash) ---
    // These models prioritize speed and might read tags aloud or ignore them.
    // We convert them to natural pauses (...)
    if (options?.modelId === 'eleven_turbo_v2_5' || options?.modelId === 'eleven_flash_v2_5') {
        // Replace <break time="..."/> with "..."
        sanitized = sanitized.replace(/<break[^>]*>/gi, '... ');

        // Remove other potential XML tags just in case
        // sanitized = sanitized.replace(/<[^>]+>/g, ''); // Too aggressive? Maybe, let's stick to break for now.
    }

    // --- 1. Real Brasileiro (R$) ---
    // Regex complexo para capturar variações:
    // - R$ 10
    // - R$ 10,00
    // - *R$ 10* (markdown)
    // - R$10 (sem espaço)

    // CASO 1: Formato Markdown (*R$ 89,90*)
    // Transforma: *R$ 89,90* -> *89,90 reais*
    sanitized = sanitized.replace(/\*R\$\s*([\d.,]+)\*/gi, '*$1 reais*');

    // CASO 2: Formato Padrão (R$ 89,90 ou R$89,90)
    // Transforma: R$ 89,90 -> 89,90 reais
    sanitized = sanitized.replace(/R\$\s*([\d.,]+)/gi, '$1 reais');

    // --- 2. Dólar ($ ou USD) ---
    // Transforma: US$ 10, $10, 10 USD -> 10 dólares
    // Evita conflito com R$ checando se não é precedido por R
    sanitized = sanitized.replace(/(?<!R)\$\s*([\d.,]+)/gi, '$1 dólares');
    sanitized = sanitized.replace(/US\$\s*([\d.,]+)/gi, '$1 dólares');
    sanitized = sanitized.replace(/([\d.,]+)\s*USD\b/gi, '$1 dólares');

    // --- 3. Euro (€ or EUR) ---
    // Transforma: € 10, 10 EUR -> 10 euros
    sanitized = sanitized.replace(/€\s*([\d.,]+)/gi, '$1 euros');
    sanitized = sanitized.replace(/([\d.,]+)\s*EUR\b/gi, '$1 euros');

    // --- 4. Limpeza Geral Final ---
    // Remove múltiplos espaços gerados
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
}
