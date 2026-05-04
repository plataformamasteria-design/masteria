// src/app/api/v1/connections/[connectionId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { encrypt } from '@/lib/crypto';
import { apiCache } from '@/lib/api-cache';

const connectionUpdateSchema = z.object({
    configName: z.string().min(1).optional(),
    wabaId: z.string().min(1).optional(),
    phoneNumberId: z.string().min(1).optional(),
    appId: z.string().min(1).optional(),
    accessToken: z.string().optional(),
    appSecret: z.string().optional(),
    assignedPersonaId: z.string().uuid().nullable().optional(),
});

// GET /api/v1/connections/[connectionId] - Get single connection details for editing

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;

        // SECURITY: Validate tenant access in WHERE clause
        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, connectionId),
            eq(connections.companyId, companyId)
        )).limit(1);

        if (!connection) {
            return NextResponse.json({ error: 'Conexão não encontrada.' }, { status: 404 });
        }

        const responseConnection = {
            ...connection,
            accessToken: '',
            appSecret: '',
            webhookSecret: '',
        }

        return NextResponse.json(responseConnection);

    } catch (error) {
        console.error('Erro ao buscar detalhes da conexão:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// PUT /api/v1/connections/[connectionId] - Update a connection
export async function PUT(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;

        const body = await request.json();
        const parsedData = connectionUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { configName, wabaId, phoneNumberId, appId, accessToken, appSecret, assignedPersonaId } = parsedData.data;

        const [result] = await db.select({ companyId: connections.companyId }).from(connections).where(eq(connections.id, connectionId)).limit(1);
        if (!result || result.companyId !== companyId) {
            return NextResponse.json({ error: 'Conexão não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        const dataToUpdate: Partial<typeof connections.$inferInsert> = {};

        if (configName) dataToUpdate.config_name = configName;
        if (wabaId) dataToUpdate.wabaId = wabaId;
        if (phoneNumberId) dataToUpdate.phoneNumberId = phoneNumberId;
        if (appId) dataToUpdate.appId = appId;
        if (accessToken) dataToUpdate.accessToken = encrypt(accessToken);
        if (appSecret) dataToUpdate.appSecret = encrypt(appSecret);
        if (assignedPersonaId !== undefined) dataToUpdate.assignedPersonaId = assignedPersonaId;


        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json({ error: 'Nenhum campo para atualizar foi fornecido.' }, { status: 400 });
        }

        // SECURITY: Validate tenant access in WHERE clause
        const [updatedConnection] = await db.update(connections)
            .set(dataToUpdate)
            .where(and(
                eq(connections.id, connectionId),
                eq(connections.companyId, companyId)
            ))
            .returning();

        // Invalidate cache
        apiCache.invalidatePattern(`connections:${companyId}`);

        return NextResponse.json(updatedConnection);
    } catch (error) {
        console.error('Erro ao atualizar conexão:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}


// DELETE /api/v1/connections/[connectionId] - Delete a connection
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;
        // SECURITY: Validate tenant access in WHERE clause
        await db.delete(connections).where(and(
            eq(connections.id, connectionId),
            eq(connections.companyId, companyId)
        ));

        // Invalidate cache
        apiCache.invalidatePattern(`connections:${companyId}`);

        return NextResponse.json({ message: 'Conexão excluída com sucesso.' }, { status: 200 });

    } catch (error) {
        console.error('Erro ao excluir conexão:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
