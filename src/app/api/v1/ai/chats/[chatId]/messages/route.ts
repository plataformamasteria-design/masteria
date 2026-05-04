// src/app/api/v1/ai/chats/[chatId]/messages/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiChatMessages, aiChats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';
import { z } from 'zod';
import { processEnhancedQuery, ConversationContext } from '@/lib/simple-chat';
import { logger, createErrorContext } from '@/lib/simple-logger';
import { v4 as uuidv4 } from 'uuid';
import { MessageCache } from '@/lib/cache/message-cache';

// Garante que a rota sempre use o runtime do Node.js, necessário para Redis, DB, etc.

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

const messagePostSchema = z.object({
  query: z.string().min(1, "A pergunta não pode estar vazia.").max(4000, "A pergunta é muito longa."),
});

const uuidSchema = z.string().uuid("O ID do chat deve ser um UUID válido.");

const responseHeaders = {
    'Allow': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
};

async function getSessionAndVerifyOwnership(chatId: string) {
    const session = await getUserSession();
    
    // Verificar se houve erro na sessão
    if (session.error) {
        if (session.errorCode === 'token_expirado') {
            throw new Error("Sua sessão expirou. Por favor, faça login novamente.");
        } else if (session.errorCode === 'token_invalido') {
            throw new Error("Sessão inválida. Por favor, faça login novamente.");
        } else if (session.errorCode === 'token_nao_encontrado') {
            throw new Error("Você precisa estar logado para enviar mensagens.");
        } else {
            throw new Error(`Erro de sessão: ${session.error}`);
        }
    }
    
    const userId = session.user?.id;
    const companyId = session.user?.companyId;

    if (!userId || !companyId) {
        throw new Error("Dados de sessão incompletos. Por favor, faça login novamente.");
    }
    
    const [chat] = await db.select({ companyId: aiChats.companyId }).from(aiChats).where(and(
        eq(aiChats.id, chatId),
        eq(aiChats.companyId, companyId)
    ));
    if (!chat) {
        throw new Error("Acesso negado a este chat.");
    }

    return { userId, companyId };
}


// OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: responseHeaders });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = await params;
    const { searchParams } = new URL(request.url);
    const verbose = searchParams.get('verbose') === '1';
    const fromDate = searchParams.get('from');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

    try {
        const parsedChatId = uuidSchema.safeParse(chatId);
        if (!parsedChatId.success) {
            return NextResponse.json({ ok: false, error: 'ID de chat inválido.' }, { status: 400, headers: responseHeaders });
        }
        
        await getSessionAndVerifyOwnership(chatId);

        // Usa cache para buscar mensagens
        const finalMessages = await MessageCache.getMessagesWithCache({
            chatId,
            limit,
            fromDate: fromDate || undefined,
        });
        
        if (verbose) {
             return NextResponse.json({
                ok: true,
                chatId,
                count: finalMessages.length,
                messages: finalMessages,
            }, { status: 200, headers: {...responseHeaders, 'X-Cache': 'MISS'} });
        }

        return NextResponse.json(finalMessages, { status: 200, headers: {...responseHeaders, 'X-Cache': 'MISS'} });

    } catch(error) {
        const err = error as Error;
        const status = err.message.includes('Acesso negado') ? 403 : err.message.includes('Sessão inválida') ? 401 : 500;
        return NextResponse.json({ ok: false, error: "Falha ao listar mensagens.", details: err.message }, { status, headers: responseHeaders });
    }
}


export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = await params;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const _isDebug = request.headers.get('x-debug') === '1';
    
    if (!idempotencyKey) {
        return NextResponse.json({ error: 'O cabeçalho Idempotency-Key é obrigatório.' }, { status: 400, headers: responseHeaders });
    }
    if (idempotencyKey.length > 72) {
        return NextResponse.json({ error: 'Idempotency-Key é muito longo.' }, { status: 400, headers: responseHeaders });
    }

    try {
        const { userId: _userId, companyId } = await getSessionAndVerifyOwnership(chatId);
        
        // CORREÇÃO: Removida a dependência do Redis para idempotência para simplificar e focar na lógica principal.
        
        const body = await request.json();
        const parsed = messagePostSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Payload inválido.', details: parsed.error.flatten() }, { status: 422, headers: responseHeaders });
        }

        const { query } = parsed.data;
        await db.insert(aiChatMessages).values({ chatId, role: 'user', content: query });
        
        // Buscar histórico de mensagens para contexto
        const previousMessages = await MessageCache.getMessagesWithCache({
            chatId,
            limit: 10, // Últimas 10 mensagens para contexto
        });
        
        // Preparar contexto para o enhanced orchestrator
        const context: ConversationContext = {
            requestId: uuidv4(),
            userId: _userId,
            companyId,
            sessionId: chatId,
            previousMessages: previousMessages.map(msg => ({
                role: msg.sender as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.createdAt)
            })),
            userPreferences: {
                language: 'pt-BR',
                tone: 'friendly',
                verbosity: 'detailed'
            }
        };
        
        const errorContext = createErrorContext({
            requestId: context.requestId,
            userId: _userId,
            companyId,
            userAgent: request.headers.get('user-agent') || '',
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
        });
        
        logger.operationStart('Enhanced Chat Processing', errorContext);
        
        // Processar com enhanced orchestrator
        const orchestratorResult = await processEnhancedQuery(query, context);
        
        // Adaptar resultado para formato esperado
        const result = {
            answer: orchestratorResult.response,
            agent: orchestratorResult.agentUsed,
            error: false,
            requestId: context.requestId,
            metadata: {
                usedFallback: orchestratorResult.usedFallback,
                usedCache: orchestratorResult.usedCache,
                confidence: orchestratorResult.confidence,
                executionTime: orchestratorResult.executionTime,
                ...orchestratorResult.metadata
            }
        };
        
        logger.info('Enhanced Chat Processing - Success', errorContext, {
            agentUsed: orchestratorResult.agentUsed,
            usedFallback: orchestratorResult.usedFallback,
            usedCache: orchestratorResult.usedCache,
            confidence: orchestratorResult.confidence,
            executionTime: orchestratorResult.executionTime
        });

        if (!result.error && result.answer) {
             const { companyId: chatCompanyId } = await getSessionAndVerifyOwnership(chatId);
             await db.insert(aiChatMessages).values({ 
                 chatId: chatId, 
                 role: 'ai', 
                 content: result.answer,
                 companyId: chatCompanyId 
             });
             await db.update(aiChats).set({ updatedAt: new Date() }).where(and(
                 eq(aiChats.id, chatId),
                 eq(aiChats.companyId, chatCompanyId)
             ));
             
             // Invalida cache de mensagens após inserir nova mensagem
             await MessageCache.invalidateChat(chatId);
        }
        
        const responseData = { ...result, idempotencyKey };

        const headers: Record<string, string> = { 
            ...responseHeaders, 
            'X-Request-Id': result.requestId,
            'X-Agent': result.agent,
            'X-Used-Fallback': result.metadata.usedFallback.toString(),
            'X-Used-Cache': result.metadata.usedCache.toString(),
            'X-Confidence': result.metadata.confidence.toString(),
            'X-Execution-Time': result.metadata.executionTime.toString()
        };
        
        return NextResponse.json(responseData, { headers });

    } catch (error) {
        const err = error as Error;
        const status = err.message.includes('Acesso negado') ? 403 : err.message.includes('Sessão inválida') ? 401 : 500;
        const errorHtml = `<p><b>Erro:</b><br/>${err.message}</p>`;
        return NextResponse.json({ answer: errorHtml, agent: null, error: true }, { status, headers: responseHeaders });
    }
}
