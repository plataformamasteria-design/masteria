import { NextRequest, NextResponse } from 'next/server';
import { saveFlow } from '@/lib/automations';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, companyId, visualData, steps } = body;

        if (!id || !name || !companyId) {
            return NextResponse.json({ success: false, error: 'Parâmetros obrigatórios ausentes.' }, { status: 400 });
        }

        const result = await saveFlow(id, name, companyId, visualData, steps || []);

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, flow: result.flow });
    } catch (error: any) {
        console.error('[API/Automations/Save] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
