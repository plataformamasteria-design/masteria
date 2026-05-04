// src/app/api/v1/ia/personas/[personaId]/sources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { ExternalSourceService, type SourceType } from '@/services/external-source.service';
import { getUserSession } from '@/app/actions';

// Validation schemas
const createSourceSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(100),
    sourceType: z.enum(['google_sheets', 'pdf', 'csv', 'website']),
    sourceUrl: z.string().url().optional(),
});

type RouteParams = { params: Promise<{ personaId: string }> };

/**
 * GET /api/v1/ia/personas/[personaId]/sources
 * List all external sources for a persona
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getUserSession();

        // Debug session properly
        if (process.env.NODE_ENV === 'development') {
            console.log('[API Debug] Session check (GET sources):', {
                hasSession: !!session,
                hasUser: !!session?.user,
                companyId: session?.user?.companyId,
                error: session?.error
            });
        }

        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { personaId } = await params;

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

        const sources = await ExternalSourceService.listByPersona(personaId);

        return NextResponse.json({ sources });
    } catch (error) {
        console.error('[API] Error listing sources:', error);
        return NextResponse.json(
            { error: 'Erro ao listar fontes externas' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/ia/personas/[personaId]/sources
 * Create a new external source (URL-based or file upload)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { personaId } = await params;

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

        // Handle multipart form data for file uploads
        const contentType = request.headers.get('content-type') || '';

        let name: string;
        let sourceType: SourceType;
        let sourceUrl: string | undefined;
        let s3Key: string | undefined;
        let originalFileName: string | undefined;

        if (contentType.includes('multipart/form-data')) {
            // File upload
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            name = formData.get('name') as string || '';
            sourceType = formData.get('sourceType') as SourceType;

            if (!file) {
                return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
            }

            // Validate file type
            const allowedTypes: Record<string, string[]> = {
                'pdf': ['application/pdf'],
                'csv': ['text/csv', 'application/csv', 'text/plain'],
            };

            if (!allowedTypes[sourceType]?.some(t => file.type.includes(t) || t.includes(file.type))) {
                return NextResponse.json(
                    { error: `Tipo de arquivo inválido para ${sourceType}. Esperado: ${allowedTypes[sourceType]?.join(', ')}` },
                    { status: 400 }
                );
            }

            // Check file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                return NextResponse.json(
                    { error: 'Arquivo muito grande. Máximo permitido: 5MB' },
                    { status: 400 }
                );
            }

            // Upload to storage
            const { uploadFileToS3 } = await import('@/lib/s3');
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileExtension = sourceType === 'pdf' ? 'pdf' : 'csv';

            // Use a clean key relative to the tenant
            // Note: uploadFileToS3 will verify/add tenancy prefix
            s3Key = `external-sources/${personaId}/${Date.now()}.${fileExtension}`;

            await uploadFileToS3(session.user.companyId, s3Key, buffer, file.type);
            originalFileName = file.name;

            if (!name) {
                name = file.name.replace(/\.[^/.]+$/, ''); // Use filename without extension as default name
            }
        } else {
            // JSON request (URL-based sources)
            const body = await request.json();
            const validated = createSourceSchema.parse(body);

            name = validated.name;
            sourceType = validated.sourceType;
            sourceUrl = validated.sourceUrl;

            if (['google_sheets', 'website'].includes(sourceType) && !sourceUrl) {
                return NextResponse.json(
                    { error: 'URL é obrigatória para este tipo de fonte' },
                    { status: 400 }
                );
            }
        }

        // Create the source
        const source = await ExternalSourceService.create({
            personaId,
            companyId: session.user.companyId,
            name,
            sourceType,
            sourceUrl,
            s3Key,
            originalFileName,
        });

        // Start sync in background (don't await)
        ExternalSourceService.syncSource(source.id).catch(error => {
            console.error(`[API] Background sync failed for source ${source.id}:`, error);
        });

        return NextResponse.json({ source }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: error.errors },
                { status: 400 }
            );
        }

        console.error('[API] Error creating source:', error);
        return NextResponse.json(
            { error: 'Erro ao criar fonte externa' },
            { status: 500 }
        );
    }
}
