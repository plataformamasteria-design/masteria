import {
  detectLanguage,
  getPersonaPromptSections,
  assembleDynamicPrompt,
} from '@/lib/prompt-utils';
import { buildEnrichedContactContext } from '@/lib/contact-context';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

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
  constructor() {}

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
      const resolvedKeys = await resolveAIKeys(companyId);
      const openaiKey = resolvedKeys.openaiApiKey;

      if (openaiKey) {
        return this.generateOpenAIResponse(userMessage, contactName, conversationHistory, persona, openaiKey, companyId, contactId);
      }
      throw new Error('No OpenAI key available. Please configure OPENAI_API_KEY in .env or add it to the database.');
    } catch (error) {
      console.error('[AI Service] Error generating response:', error);
      throw error;
    }
  }

  private async generateOpenAIResponse(
    userMessage: string,
    contactName: string | undefined,
    conversationHistory: ChatMessage[],
    persona: any,
    openaiKey: string,
    companyId?: string,
    contactId?: string
  ): Promise<string> {
    console.log(`[AI Service] Generating response with OpenAI: ${persona.name}`);

    const modelsToTry = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
    const initialModel = persona.model && persona.model.startsWith('gpt-') ? persona.model : 'gpt-4o';

    const orderedModels = modelsToTry.includes(initialModel)
      ? [initialModel, ...modelsToTry.filter(m => m !== initialModel)]
      : [initialModel, ...modelsToTry];

    let lastError: any = null;

    for (const modelName of orderedModels) {
      try {
        const url = 'https://api.openai.com/v1/chat/completions';
        const detectedLanguage = detectLanguage(userMessage);
        let systemPrompt: string;

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

        const validContents: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-10).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user', // Limpar papéis inválidos
            content: msg.content
          })),
          { role: 'user', content: userMessage }
        ];

        const body = {
          model: modelName,
          messages: validContents,
          temperature: parseFloat(String(persona.temperature || 0.7)),
          max_tokens: parseInt(String(persona.maxOutputTokens || 500), 10),
        };

        console.log(`[AI Service] Calling OpenAI API (${modelName})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify(body)
        });

        console.log(`[AI Service] OpenAI API Response status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content;
        const totalTokens = data.usage?.total_tokens || 0;

        if (!aiResponse) {
          throw new Error('IA retornou resposta vazia (OpenAI)');
        }

        const finalResponse = totalTokens > 0 ? `${aiResponse}\n\n___TOKENS:${totalTokens}` : aiResponse;

        console.log(`[AI Service] OpenAI Response generated with ${modelName}:`, aiResponse.substring(0, 50));
        return finalResponse;

      } catch (error: any) {
        console.warn(`[AI Service] Falha no modelo ${modelName}: ${error.message}. Tentando próximo...`);
        lastError = error;
      }
    }

    throw lastError || new Error('Todos os modelos OpenAI falharam.');
  }

  async isAvailable(companyId?: string): Promise<boolean> {
    try {
      const resolvedKeys = await resolveAIKeys(companyId);
      if (resolvedKeys.openaiApiKey) return true;
      return false;
    } catch (error) {
      console.error('[AI Service] Service unavailable:', error);
      return false;
    }
  }
}

export const openAIService = new OpenAIService();
