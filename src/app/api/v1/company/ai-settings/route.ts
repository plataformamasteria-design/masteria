// src/app/api/v1/company/ai-settings/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';

const aiSettingsSchema = z.object({
    // MCP settings moved to ai_personas table
    // This endpoint is deprecated - use /api/v1/ia/personas/[personaId] instead
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = aiSettingsSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        // MCP configuration has been moved to ai_personas table
        // This endpoint is deprecated
        
        await db.update(companies)
            .set({ 
                updatedAt: new Date() 
            })
            .where(eq(companies.id, companyId));
            
        return NextResponse.json({ success: true, message: 'Configurações de IA salvas com sucesso.'});
    } catch (error) {
        console.error('Erro ao atualizar configurações de IA:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
