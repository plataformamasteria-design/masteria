import {
  detectLanguage,
  getPersonaPromptSections,
  assembleDynamicPrompt,
} from '@/lib/prompt-utils';
import { buildEnrichedContactContext } from '@/lib/contact-context';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const INTERNAL_RULES = `REGRAS INTERNAS OBRIGATÓRIAS:
- NUNCA se identifique como "assistente virtual", "IA", "inteligência artificial", "robô", "bot" ou similar
- Você é um atendente REAL da empresa, não um sistema automatizado
- Seja genuíno, autêntico e natural nas interações
- Responda como se fosse uma pessoa de verdade atendendo pelo WhatsApp
- Mantenha a naturalidade e humanização em todas as respostas`;

export class OpenAIService {
  private client: any | null = null; // OpenAI client removed
  private geminiKey: string | undefined;

  constructor() {
    // Updated to use the new Gemini keys provided by user
    this.geminiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.gemini_25_agent_google_chat;

    // OpenAI client initialization removed to enforce Gemini exclusivity
    this.client = null;
  }

  /**
   * @deprecated Método genérico removido - use apenas generateResponseWithPersona()
   * Sistema configurado para responder APENAS com agentes IA personalizados vinculados
   */
  async generateResponse(
    userMessage: string,
    contactName?: string,
    _conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    throw new Error('Generic AI responses are disabled. Please assign an AI persona to the conversation.');
  }

  async generateResponseWithPersona(
    userMessage: string,
    contactName: string | undefined,
    conversationHistory: ChatMessage[],
    persona: any,
    companyId?: string,
    contactId?: string
  ): Promise<string> {
    try {
      // Force Gemini usage as requested by user (OpenAI/OpenRouter removed)
      if (this.geminiKey) {
        return this.generateGeminiResponse(userMessage, contactName, conversationHistory, persona, companyId, contactId);
      }
      throw new Error('No Gemini key available. Please configure GOOGLE_GEMINI_AGENTS1 or GOOGLE_GEMINI_AGENTS2 in .env');
    } catch (error) {
      console.error('[AI Service] Error generating response:', error);
      throw error;
    }
  }

  private async generateGeminiResponse(
    userMessage: string,
    contactName: string | undefined,
    conversationHistory: ChatMessage[],
    persona: any,
    companyId?: string,
    contactId?: string
  ): Promise<string> {
    console.log(`[AI Service] Generating response with Gemini: ${persona.name}`);

    // ✅ Usar modelos oficiais do Gemini (Priorizando 2.0 Flash Exp que foi validado)
    const geminiModels = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite-preview-02-05'];
    const initialModel = persona.model || geminiModels[0];

    // Se o modelo configurado não estiver na lista de fallback, adiciona no início
    const modelsToTry = geminiModels.includes(initialModel)
      ? [initialModel, ...geminiModels.filter(m => m !== initialModel)]
      : [initialModel, ...geminiModels];

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.geminiKey}`;

        const detectedLanguage = detectLanguage(userMessage);
        let systemPrompt: string;

        // Build enriched context if companyId and contactId are available
        let contextInfo = '';
        if (companyId && contactId) {
          contextInfo = await buildEnrichedContactContext(companyId, contactId, contactName || 'Cliente', '');
        } else {
          contextInfo = contactName ? `\n\nCONTEXTO DO CONTATO:\n- Nome: ${contactName}` : '';
        }

        if (persona.useRag) {
          const promptSections = await getPersonaPromptSections(persona.id, detectedLanguage);
          if (promptSections.length > 0) {
            systemPrompt = INTERNAL_RULES + '\n\n' + assembleDynamicPrompt(promptSections, contextInfo);
          } else {
            systemPrompt = persona.systemPrompt || `Você é ${persona.name}, um atendente especializado da empresa no WhatsApp.`;
            systemPrompt = INTERNAL_RULES + '\n\n' + systemPrompt;
            systemPrompt += contextInfo;
          }
        } else {
          systemPrompt = persona.systemPrompt || `Você é ${persona.name}, um atendente especializado da empresa no WhatsApp.`;
          systemPrompt = INTERNAL_RULES + '\n\n' + systemPrompt;
          systemPrompt += contextInfo;
        }

        // ✅ CORREÇÃO: Gemini exige que o histórico comece com 'user'.
        // Mapeamos assistant -> model e user/system -> user
        const validContents = conversationHistory.slice(-6).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        // Adicionar mensagem atual do usuário
        validContents.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });

        // Garantir alternância correta (User -> Model -> User -> Model ...)
        const sanitizedContents: typeof validContents = [];
        let lastRole = '';

        for (const msg of validContents) {
          if (msg.role !== lastRole) {
            sanitizedContents.push(msg);
            lastRole = msg.role;
          } else {
            // Mesclar conteúdo se for do mesmo papel para evitar erro
            if (sanitizedContents.length > 0) {
              const last = sanitizedContents[sanitizedContents.length - 1];
              const lastPart = last?.parts?.[0];
              const currentPart = msg.parts?.[0];
              if (lastPart && currentPart) {
                lastPart.text += `\n---\n${currentPart.text}`;
              }
            }
          }
        }

        // Verificação final de segurança: O primeiro DEVE ser user
        const first = sanitizedContents[0];
        if (first && first.role === 'model') {
          // Em vez de remover (shift), inserimos um contexto inicial fictício para manter a resposta do modelo
          console.warn('[AI Service] Histórico iniciava com model. Inserindo user filler.');
          sanitizedContents.unshift({
            role: 'user',
            parts: [{ text: 'Histórico da conversa anterior:' }]
          });
        }

        // Log do payload final para debug
        // console.log('[AI Service] Final Gemini Payload contents:', JSON.stringify(sanitizedContents, null, 2));

        const body = {
          contents: sanitizedContents,
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: parseFloat(String(persona.temperature || 0.7)),
            maxOutputTokens: parseInt(String(persona.maxOutputTokens || 500), 10),
          }
        };

        console.log(`[AI Service] Calling Google Gemini API (${modelName})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        console.log(`[AI Service] Google API Response status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Google API error: ${response.statusText}`);
        }

        const data = await response.json();
        // console.log(`[AI Service] Data received: ${JSON.stringify(data).substring(0, 100)}...`);
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponse) {
          throw new Error('IA retornou resposta vazia (Gemini)');
        }

        console.log(`[AI Service] Gemini Response generated with ${modelName}:`, aiResponse.substring(0, 50));
        return aiResponse;

      } catch (error: any) {
        console.warn(`[AI Service] Falha no modelo ${modelName}: ${error.message}. Tentando próximo...`);
        lastError = error;
        // Continua para o próximo modelo
      }
    }

    throw lastError || new Error('Todos os modelos Gemini falharam.');
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.geminiKey) return true;
      if (this.client) {
        await this.client.models.list();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AI Service] Service unavailable:', error);
      return false;
    }
  }
}

export const openAIService = new OpenAIService();
