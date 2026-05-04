// src/app/api/v1/ia/personas/[personaId]/sources/[sourceId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ExternalSourceService } from '@/services/external-source.service';
import { getStorageProvider } from '@/lib/s3';
import { getUserSession } from '@/app/actions';

type RouteParams = { params: Promise<{ personaId: string; sourceId: string }> };

/**
 * GET /api/v1/ia/personas/[personaId]/sources/[sourceId]
 * Get a specific external source
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { personaId, sourceId } = await params;

        // Verify persona belongs to user's company
        const [persona] = await db.select()
            .from(aiPersonas)
            .where(and(
                eq(aiPersonas.id, personaId),
                eq(aiPersonas.companyId, session.user.companyId)
            ));

        if (!persona) {
            return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
        }

        const source = await ExternalSourceService.getById(sourceId);

        if (!source || source.personaId !== personaId) {
            return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
        }

        return NextResponse.json({ source });
    } catch (error) {
        console.error('[API] Error getting source:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar fonte externa' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/ia/personas/[personaId]/sources/[sourceId]
 * Delete an external source and its associated RAG sections
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { personaId, sourceId } = await params;

        // Verify persona belongs to user's company
        const [persona] = await db.select()
            .from(aiPersonas)
            .where(and(
                eq(aiPersonas.id, personaId),
                eq(aiPersonas.companyId, session.user.companyId)
            ));

        if (!persona) {
            return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
        }

        const source = await ExternalSourceService.getById(sourceId);

        if (!source || source.personaId !== personaId) {
            return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
        }

        // Delete file from storage if exists
        if (source.s3Key) {
            try {
                const storage = await getStorageProvider();
                await storage.deleteFile(source.s3Key);
            } catch (error) {
                console.warn('[API] Failed to delete source file:', error);
                // Continue with deletion even if file delete fails
            }
        }

        await ExternalSourceService.delete(sourceId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting source:', error);
        return NextResponse.json(
            { error: 'Erro ao excluir fonte externa' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/ia/personas/[personaId]/sources/[sourceId]
 * Trigger re-sync of an external source
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { personaId, sourceId } = await params;

        // Verify persona belongs to user's company
        const [persona] = await db.select()
            .from(aiPersonas)
            .where(and(
                eq(aiPersonas.id, personaId),
                eq(aiPersonas.companyId, session.user.companyId)
            ));

        if (!persona) {
            return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
        }

        const source = await ExternalSourceService.getById(sourceId);

        if (!source || source.personaId !== personaId) {
            return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
        }

        // Check if already syncing
        if (source.syncStatus === 'syncing') {
            return NextResponse.json(
                { error: 'Sincronização já em andamento' },
                { status: 409 }
            );
        }

        // Start sync in background
        ExternalSourceService.syncSource(sourceId).catch(error => {
            console.error(`[API] Background re-sync failed for source ${sourceId}:`, error);
        });

        return NextResponse.json({
            message: 'Sincronização iniciada',
            source: { ...source, syncStatus: 'syncing' }
        });
    } catch (error) {
        console.error('[API] Error triggering sync:', error);
        return NextResponse.json(
            { error: 'Erro ao iniciar sincronização' },
            { status: 500 }
        );
    }
}
