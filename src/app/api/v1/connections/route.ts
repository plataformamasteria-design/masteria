// src/app/api/v1/connections/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { encrypt } from '@/lib/crypto';
import { apiCache } from '@/lib/api-cache';
import { getCompanyIdFromSession } from '@/app/actions';
import { evolutionApiService } from '@/services/evolution-api.service';

const connectionSchema = z.object({
    configName: z.string().min(1, 'Nome da conexão é obrigatório'),
    connectionType: z.enum(['meta_api', 'instagram']).optional().default('meta_api'),
    wabaId: z.string().min(1, 'WABA ID é obrigatório'),
    phoneNumberId: z.string().min(1, 'ID do telefone é obrigatório'),
    appId: z.string().min(1, 'ID do Aplicativo é obrigatório'),
    accessToken: z.string().min(1, 'Token de acesso é obrigatório'),
    appSecret: z.string().min(1, 'App Secret é obrigatório'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const authResult = await requireCompanyIdOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        const { companyId } = authResult;

        // Force cache invalidation for this request to ensure Baileys connections are seen
        const cacheKey = `connections:${companyId}`;
        const companyConnections = await db
            .select({
                id: connections.id,
                companyId: connections.companyId,
                config_name: connections.config_name,
                connectionType: connections.connectionType,
                wabaId: connections.wabaId,
                phoneNumberId: connections.phoneNumberId,
                appId: connections.appId,
                accessToken: connections.accessToken,
                webhookSecret: connections.webhookSecret,
                appSecret: connections.appSecret,
                isActive: connections.isActive,
                phone: connections.phone,
                assignedPersonaId: connections.assignedPersonaId,
                createdAt: connections.createdAt,
                // Token Metadata
                tokenType: connections.tokenType,
                tokenExpiresAt: connections.tokenExpiresAt,
                tokenLastRefreshed: connections.tokenLastRefreshed,
                tokenRefreshFailedAt: connections.tokenRefreshFailedAt,
                tokenRefreshError: connections.tokenRefreshError
            })
            .from(connections)
            .where(eq(connections.companyId, companyId))
            .orderBy(desc(connections.createdAt));

        // Retorna os dados, mas o token permanece encriptado
        const connectionsWithRealtimeStatus = await Promise.all(companyConnections.map(async conn => {
            if (conn.connectionType === 'baileys' || conn.connectionType === 'evolution') {
                let statusData: any;
                let status: string | null = null;
                try {
                    statusData = await evolutionApiService.getConnectionState(conn.id);
                    status = statusData?.instance?.state || null;
                } catch (e) {
                    status = null;
                }

                let mappedStatus = conn.isActive ? 'Não Verificado' : 'Falha na Conexão';

                if (status === 'open') {
                    mappedStatus = 'Conectado';
                } else if (status === 'close' || status === 'disconnected') {
                    mappedStatus = 'Falha na Conexão';
                }

                return {
                    ...conn,
                    // Inject real-time status overriding DB status for display
                    connectionStatus: mappedStatus,
                    // Pass raw status for advanced UI controls
                    baileysStatus: status || (conn.isActive ? 'connecting' : 'disconnected')
                };
            }
            return conn;
        }));

        return NextResponse.json(connectionsWithRealtimeStatus, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        // Se já é uma resposta NextResponse (401), retorna diretamente
        if (error instanceof NextResponse) {
            return error;
        }
        console.error('Erro ao buscar conexões:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = connectionSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { configName, connectionType, wabaId, phoneNumberId, accessToken, appSecret, appId } = parsedData.data;

        // Encrypt app secret first (needed for token exchange)
        const encryptedAppSecret = encrypt(appSecret);

        // Auto-exchange for long-lived token if this is a Meta API connection
        let finalAccessToken = accessToken;
        let tokenType: 'short_lived' | 'long_lived' | null = null;
        let tokenExpiresAt: Date | null = null;

        if (connectionType === 'meta_api' || connectionType === 'instagram' || connectionType === 'instagram_direct') {
            try {
                console.log('[Connections API] Attempting to exchange for long-lived token...');
                const { metaTokenManager } = await import('@/lib/meta-token-manager');

                const longLivedToken = await metaTokenManager.exchangeForLongLivedToken(
                    accessToken,
                    appId,
                    appSecret
                );

                finalAccessToken = longLivedToken.accessToken;
                tokenType = 'long_lived';

                // Calculate expiration date
                // Safety check: expiresIn might be missing or invalid (e.g. system user tokens)
                const expiresInSeconds = (typeof longLivedToken.expiresIn === 'number' && !isNaN(longLivedToken.expiresIn))
                    ? longLivedToken.expiresIn
                    : 5184000; // Default to 60 days (60 * 24 * 60 * 60) if undefined

                const expiresInMs = expiresInSeconds * 1000;
                tokenExpiresAt = new Date(Date.now() + expiresInMs);

                // Double fail-safe
                if (isNaN(tokenExpiresAt.getTime())) {
                    console.warn('[Connections API] ⚠️ Calculated Date was invalid, falling back to 60 days default.');
                    tokenExpiresAt = new Date(Date.now() + 5184000 * 1000);
                }

                console.log(`[Connections API] ✅ Token exchanged successfully. Expires in ~${Math.floor(longLivedToken.expiresIn / 86400)} days`);
            } catch (error) {
                // Se já é uma resposta NextResponse (401), retorna diretamente
                if (error instanceof NextResponse) {
                    return error;
                }
                console.warn('[Connections API] ⚠️ Failed to exchange token, using original:', error);
                // Fall back to short-lived token
                tokenType = 'short_lived';
                // Short-lived tokens typically expire in 1-2 hours
                tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
            }
        }

        // Encrypt final access token
        const encryptedAccessToken = encrypt(finalAccessToken);

        const existingConnections = await db.select({ id: connections.id }).from(connections).where(eq(connections.companyId, companyId)).limit(1);
        const isFirstConnection = existingConnections.length === 0;

        const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

        const [newConnection] = await db.insert(connections).values({
            companyId,
            config_name: configName,
            connectionType: connectionType || 'meta_api',
            wabaId,
            phoneNumberId,
            appId,
            accessToken: encryptedAccessToken,
            webhookSecret: 'placeholder', // This is now managed internally
            appSecret: encryptedAppSecret,
            isActive: isFirstConnection,
            environment: currentEnv,
            // Token management fields
            tokenType,
            tokenExpiresAt,
            tokenLastRefreshed: tokenType === 'long_lived' ? new Date() : null,
        }).returning();

        if (!newConnection) {
            throw new Error("Falha ao criar a conexão no banco de dados.");
        }

        // Invalidate cache
        apiCache.invalidatePattern(`connections:${companyId}`);

        const responseConnection = {
            ...newConnection,
            configName: newConnection.config_name
        }

        return NextResponse.json(responseConnection, { status: 201 });
    } catch (error) {
        // Se já é uma resposta NextResponse (401), retorna diretamente
        if (error instanceof NextResponse) {
            return error;
        }
        console.error('Erro ao criar conexão:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
