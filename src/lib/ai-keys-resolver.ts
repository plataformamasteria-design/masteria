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
        // Ignorando as consultas ao banco de dados e forçando o uso exclusivo das variáveis do .env 
        // conforme solicitado pelo usuário.
    } catch (error) {
        console.error('[resolveAIKeys] Erro ao buscar chaves no banco de dados:', error);
        // Em caso de erro no banco (por ex., tabela nao criada ainda), continua usando o fallback silenciosamente
    }

    return keys;
}
