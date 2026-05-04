// src/app/api/v1/ia/personas/[personaId]/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { aiPersonas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface TestRequest {
  message: string;
  conversationHistory?: TestMessage[];
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { personaId } = await params;
    const { message, conversationHistory = [] }: TestRequest = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    const persona = await db.query.aiPersonas.findFirst({
      where: and(
        eq(aiPersonas.id, personaId),
        eq(aiPersonas.companyId, companyId)
      ),
    });

    if (!persona) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    // ✅ PRIORIDADE: Google Gemini (Provedor Exclusivo)
    const geminiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: 'Chave API do Google Gemini não configurada' }, { status: 400 });
    }

    console.log(`[IA Test] Using Google Gemini (Suffix: ...${geminiKey.slice(-4)})`);

    const geminiModels = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ];

    const initialModel = persona?.model || geminiModels[0];
    // Ensure we try the selected model first, then fallbacks
    const modelsToTry = (initialModel && geminiModels.includes(initialModel))
        ? [initialModel, ...geminiModels.filter(m => m !== initialModel)]
        : [initialModel || geminiModels[0], ...geminiModels];

    let successResponse: any = null;
    let usedModel = initialModel;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[IA Test] Trying Gemini model: ${modelName}`);

        const history = conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: persona.systemPrompt || 'Você é um assistente virtual prestativo.' }] }, // System prompt as first user message for simple compatibility or use system_instruction if supported by specific model version, but user message is safer for broad compatibility
              ...history,
              { role: 'user', parts: [{ text: message }] }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`[IA Test] Gemini error for ${modelName}:`, errorData);
          continue;
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponse) {
          continue;
        }

        successResponse = {
          aiResponse,
          tokensUsed: data.usageMetadata?.totalTokenCount || 0
        };
        usedModel = modelName;
        break;
      } catch (error: any) {
        console.warn(`[IA Test] Falha no modelo ${modelName}: ${error.message}`);
      }
    }

    if (successResponse) {
      const updatedHistory: TestMessage[] = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: Date.now() },
        { role: 'assistant', content: successResponse.aiResponse, timestamp: Date.now() },
      ];

      return NextResponse.json({
        success: true,
        response: successResponse.aiResponse,
        conversationHistory: updatedHistory,
        tokensUsed: successResponse.tokensUsed,
        model: usedModel,
        provider: 'google'
      });
    }

    return NextResponse.json({ error: 'Todos os modelos do Gemini falharam' }, { status: 500 });
  } catch (error: any) {
    console.error('[IA Test] Erro geral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
