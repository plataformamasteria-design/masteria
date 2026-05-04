import { db } from '@/lib/db';
import { companyCredentials, systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface ResolvedAIKeys {
    openaiApiKey: string | null;
    geminiApiKey: string | null;
    elevenlabsApiKey: string | null;
}

/**
 * Resolve as chaves de IA seguindo a prioridade:
 * 1. Chave local da Empresa (se tiver companyId e a chave estiver preenchida)
 * 2. Chave Global do Sistema (tabela system_settings com id='global')
 * 3. Fallback para variáveis de ambiente locais (.env)
 */
export async function resolveAIKeys(companyId?: string | null): Promise<ResolvedAIKeys> {
    const keys: ResolvedAIKeys = {
        openaiApiKey: process.env.OPENAI_API_KEY || null,
        geminiApiKey: process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null,
        elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || null,
    };

    try {
        // 1. Busca Chave Global do Sistema
        const [globalSettings] = await db.select().from(systemSettings).where(eq(systemSettings.id, 'global'));
        
        if (globalSettings) {
            if (globalSettings.openaiApiKey) keys.openaiApiKey = globalSettings.openaiApiKey;
            if (globalSettings.geminiApiKey) keys.geminiApiKey = globalSettings.geminiApiKey;
            if (globalSettings.elevenlabsApiKey) keys.elevenlabsApiKey = globalSettings.elevenlabsApiKey;
        }

        // 2. Busca Chave Local da Empresa (Sobrescreve a Global e a .env)
        if (companyId) {
            const [companyCreds] = await db.select().from(companyCredentials).where(eq(companyCredentials.companyId, companyId));
            if (companyCreds) {
                if (companyCreds.openaiApiKey) keys.openaiApiKey = companyCreds.openaiApiKey;
                if (companyCreds.geminiApiKey) keys.geminiApiKey = companyCreds.geminiApiKey;
                if (companyCreds.elevenlabsApiKey) keys.elevenlabsApiKey = companyCreds.elevenlabsApiKey;
            }
        }
    } catch (error) {
        console.error('[resolveAIKeys] Erro ao buscar chaves no banco de dados:', error);
        // Em caso de erro no banco (por ex., tabela nao criada ainda), continua usando o fallback silenciosamente
    }

    return keys;
}
