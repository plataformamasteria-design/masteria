// src/app/api/v1/connections/[connectionId]/refresh-token/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { tokenRefreshService } from '@/services/token-refresh.service';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/v1/connections/[connectionId]/refresh-token
 * Manually refresh a connection's access token
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;

        // Verify connection belongs to user's company
        const [connection] = await db
            .select()
            .from(connections)
            .where(
                and(
                    eq(connections.id, connectionId),
                    eq(connections.companyId, companyId)
                )
            );

        if (!connection) {
            return NextResponse.json(
                { error: 'Conexão não encontrada ou não pertence à sua empresa.' },
                { status: 404 }
            );
        }

        // Attempt to refresh the token
        console.log(`[Refresh Token API] Refreshing token for connection: ${connection.config_name}`);

        try {
            await tokenRefreshService.refreshConnectionToken(connectionId);

            // Get updated connection data
            const [updatedConnection] = await db
                .select({
                    tokenExpiresAt: connections.tokenExpiresAt,
                    tokenLastRefreshed: connections.tokenLastRefreshed,
                    tokenType: connections.tokenType,
                })
                .from(connections)
                .where(eq(connections.id, connectionId));

            return NextResponse.json({
                success: true,
                message: 'Token atualizado com sucesso',
                data: {
                    tokenType: updatedConnection?.tokenType,
                    tokenExpiresAt: updatedConnection?.tokenExpiresAt,
                    tokenLastRefreshed: updatedConnection?.tokenLastRefreshed,
                },
            });
        } catch (refreshError) {
            console.error('[Refresh Token API] Failed to refresh token:', refreshError);

            return NextResponse.json(
                {
                    success: false,
                    error: refreshError instanceof Error ? refreshError.message : 'Falha ao renovar token',
                    message: 'Não foi possível renovar o token automaticamente. Você precisará gerar um novo token manualmente no Meta Graph API Explorer.',
                },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('[Refresh Token API] Error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor.' },
            { status: 500 }
        );
    }
}
