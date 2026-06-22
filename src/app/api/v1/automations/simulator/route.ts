import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPersonaPromptSections, assembleDynamicPrompt } from '@/lib/prompt-utils';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

function getValidOpenAIModel(modelName: string | undefined): string {
    if (!modelName) return 'gpt-4o-mini';
    const lower = modelName.toLowerCase();
    
    if (lower.startsWith('gpt-') || lower.startsWith('o1-') || lower.startsWith('o3-')) {
        return modelName;
    }
    if (lower === 'chatgpt-4o-latest') return modelName;

    if (lower.includes('chatgpt-4')) return 'gpt-4-turbo';
    if (lower.includes('chatgpt-3')) return 'gpt-3.5-turbo';
    
    return 'gpt-4o-mini';
}

export async function POST(req: NextRequest) {
    try {
        console.log('[SIMULATOR AI] Request received');
        const body = await req.json();
        console.log('[SIMULATOR AI] Body parsed:', Object.keys(body));
        const { 
            simulate_ai_virtual, 
            simulate_ai_node,
            classify_intent_virtual,
            classify_intent,
            config, 
            virtual_history, 
        } = body;
        
        const isGemini = (config.model || '').toLowerCase().startsWith('gemini');

        // Extract organizationId safely, fallback to a dummy string to bypass if not found
        // Since we are simulating, we mainly care about the personaId.
        const orgId = body.organization_id || 'sim-org';
        const resolvedKeys = await resolveAIKeys(orgId);

        // ==== INJECT PERSONA PROMPT IF APPLICABLE ====
        let finalSystemMessage = config.system_message || '';
        if (config.personaId) {
            try {
                // Fetch sections for this persona
                const sections = await getPersonaPromptSections(orgId, config.personaId, 'pt');
                if (sections && sections.length > 0) {
                    const lastUserMessage = virtual_history?.length ? virtual_history[virtual_history.length - 1].content : '';
                    const dynamicPrompt = assembleDynamicPrompt(sections, '', lastUserMessage);
                    // Combine node's base prompt with persona prompt
                    finalSystemMessage = `${finalSystemMessage}\n\n${dynamicPrompt}`.trim();
                }
            } catch (err) {
                console.error('[SIMULATOR AI] Error fetching persona prompt:', err);
            }
        }

        // ==== CLASSIFY INTENT ====
        if (classify_intent || classify_intent_virtual) {
            const routes = config.intents || config.routes || [];
            const routeLabels = routes.map((r: any) => typeof r === 'string' ? r : r.label).filter(Boolean).join(', ');
            const systemPrompt = `Você é um classificador de intenções avaliando o histórico de um diálogo. Baseado em TODO o contexto da conversa, classifique qual foi a intenção principal do usuário neste atendimento em EXATAMENTE UMA destas opções: ${routeLabels}.\nSe não for nenhuma delas, responda "OUTROS". Responda APENAS com a palavra da opção exata.`;
            
            const fullConversation = (virtual_history || []).map((m: any) => `${m.role === 'user' ? 'Lead' : 'Atendente'}: ${m.content}`).join('\n');
            const messages: any[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `[HISTÓRICO DO DIÁLOGO]\n${fullConversation}` }
            ];

            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const GEMINI_KEY = resolvedKeys.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
            const primaryKey = isGemini ? GEMINI_KEY : OPENAI_KEY;

            const executeIntentFallback = async () => {
                try {
                    if (!primaryKey) throw new Error('Primary API Key missing');
                    const client = new OpenAI({
                        apiKey: primaryKey,
                        ...(isGemini ? { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' } : {})
                    });
                    return await client.chat.completions.create({
                        model: isGemini ? config.model : getValidOpenAIModel(config.model),
                        messages,
                        temperature: 0,
                    });
                } catch (error: any) {
                    console.warn(`[SIMULATOR INTENT] Fallback triggered. Error:`, error.message);
                    const fallbackModel = isGemini ? 'gpt-4o-mini' : 'gemini-2.5-flash';
                    const fallbackKey = isGemini ? OPENAI_KEY : GEMINI_KEY;
                    if (!fallbackKey) throw error;

                    const fallbackClient = new OpenAI({
                        apiKey: fallbackKey,
                        ...(isGemini ? {} : { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
                    });
                    return await fallbackClient.chat.completions.create({
                        model: fallbackModel,
                        messages,
                        temperature: 0,
                    });
                }
            };

            const completion = await executeIntentFallback();
            return NextResponse.json({ 
                intent: completion.choices[0]?.message?.content?.trim() || 'OUTROS',
                total_tokens: completion.usage?.total_tokens || 0
            });
        }

        // ==== SIMULATE AI NODE ====
        if (simulate_ai_virtual || simulate_ai_node) {
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const GEMINI_KEY = resolvedKeys.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
            const primaryKey = isGemini ? GEMINI_KEY : OPENAI_KEY;

            let messages: any[] = [];
            if (finalSystemMessage) messages.push({ role: 'system', content: finalSystemMessage });
            
            if (virtual_history && virtual_history.length > 0) {
                for (const msg of virtual_history) {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                }
            } else if (config.prompt) {
                messages.push({ role: 'user', content: config.prompt });
            }

            const executeSimulatorWithFallback = async () => {
                try {
                    if (!primaryKey) throw new Error(`Primary key missing`);
                    const client = new OpenAI({
                        apiKey: primaryKey,
                        ...(isGemini ? { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' } : {})
                    });
                    return await client.chat.completions.create({
                        model: isGemini ? config.model : getValidOpenAIModel(config.model),
                        messages,
                        temperature: config.temperature ?? 0.7,
                    });
                } catch (error: any) {
                    console.warn(`[SIMULATOR AI] Fallback triggered. Error:`, error.message);
                    const fallbackModel = isGemini ? 'gpt-4o-mini' : 'gemini-2.5-flash';
                    const fallbackKey = isGemini ? OPENAI_KEY : GEMINI_KEY;
                    if (!fallbackKey) throw error; 

                    const fallbackClient = new OpenAI({
                        apiKey: fallbackKey,
                        ...(isGemini ? {} : { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
                    });
                    return await fallbackClient.chat.completions.create({
                        model: fallbackModel,
                        messages,
                        temperature: config.temperature ?? 0.7,
                    });
                }
            };

            const completion = await executeSimulatorWithFallback();
            return NextResponse.json({ 
                response: completion.choices[0]?.message?.content?.trim() || '',
                total_tokens: completion.usage?.total_tokens || 0
            });
        }

        return NextResponse.json({ error: 'Operação não suportada' }, { status: 400 });
    } catch (error: any) {
        console.error('[SIMULATOR AI] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
