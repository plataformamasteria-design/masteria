import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { executeCopilotCommand } from '@/lib/copilot-engine';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuthOr401();
        if ('status' in auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'O campo prompt é obrigatório.' }, { status: 400 });
        }

        const result = await executeCopilotCommand(prompt, auth.companyId, undefined, 12);

        return NextResponse.json({
            success: true,
            reply: result.reply,
            toolCalls: result.toolCalls
        });

    } catch (error: any) {
        console.error('[API Copilot] Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no Copilot' }, { status: 500 });
    }
}
