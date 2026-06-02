// src/app/api/v1/automations/fields-map/route.ts
import { NextResponse } from 'next/server';
import { getAutomationFieldsMap } from '@/app/actions/automations-builder';

/**
 * GET /api/v1/automations/fields-map
 *
 * Retorna o mapa de campos personalizados por automação V4.
 * Usado pelo Kanban (page.tsx e edit/page.tsx) para enriquecer o
 * dropdown "Filtrar por formulário/origem" com nomes corretos.
 *
 * Response: Array<{ flowId: string; flowName: string; fields: string[] }>
 */
export async function GET() {
    try {
        const data = await getAutomationFieldsMap();
        return NextResponse.json(data);
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[/api/v1/automations/fields-map]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
