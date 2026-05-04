// src/app/api/v1/mcp/[...path]/route.ts

import { NextResponse, type NextRequest } from 'next/server';

const EXTERNAL_VALIDATION_API_URL = 'https://multidesk-master-ia-agentes.vs1kre.easypanel.host/mcp/validate';

/**
 * Rota de proxy para validar um servidor MCP através de uma API externa.
 * Recebe a URL do MCP do cliente, envia para a API de validação externa e retorna a resposta.
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // CORREÇÃO: A variável enviada pelo frontend é 'mcpUrl', não 'url'.
        const { mcpUrl, mcpServerHeaders } = body;

        if (!mcpUrl) {
            return NextResponse.json({ error: 'A URL do servidor MCP é obrigatória.' }, { status: 400 });
        }

        const response = await fetch(EXTERNAL_VALIDATION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                url: mcpUrl, // A API externa espera 'url'
                headers: mcpServerHeaders || {},
                timeout: 30
            }),
        });
        
        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        
        return NextResponse.json(data);

    } catch (error) {
        console.error('[MCP Proxy Route] Erro:', error);
        return NextResponse.json({ error: 'Erro interno no proxy do servidor.' }, { status: 500 });
    }
}
