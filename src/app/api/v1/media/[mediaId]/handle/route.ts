// src/app/api/v1/media/[mediaId]/handle/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { mediaAssets, connections, type MetaHandle } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

const requestSchema = z.object({
    connectionId: z.string().uuid("ID da conexão é inválido."),
});

// POST /api/v1/media/[mediaId]/handle - Get or refresh Meta media handle

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { connectionId } = parsed.data;
        const { mediaId } = await params;

        // SECURITY: Validar tenant ao buscar media asset
        const [asset] = await db.select().from(mediaAssets).where(and(
            eq(mediaAssets.id, mediaId),
            eq(mediaAssets.companyId, companyId)
        ));
        if (!asset) {
            return NextResponse.json({ error: 'Ativo de mídia não encontrado.' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao buscar conexão
        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, connectionId),
            eq(connections.companyId, companyId)
        ));
        if (!connection) {
            return NextResponse.json({ error: 'Conexão não encontrada.' }, { status: 404 });
        }

        const wabaId = connection?.wabaId;
        const appId = connection?.appId;
        if (!wabaId) {
            return NextResponse.json({ error: 'Conexão não possui WABA ID configurado.' }, { status: 400 });
        }
        if (!appId) {
            return NextResponse.json({ error: 'Conexão não possui App ID configurado. O App ID é necessário para gerar handles de aprovação.' }, { status: 400 });
        }

        const existingHandles = (asset.metaHandles || []) as MetaHandle[];
        const existingHandle = existingHandles.find(h => h.wabaId === wabaId);
        if (existingHandle) {
            return NextResponse.json({ success: true, handle: existingHandle.handle, message: 'Handle existente reutilizado.' });
        }

        if (!connection.accessToken) {
            throw new Error("Token de acesso não configurado para esta conexão.");
        }
        const accessToken = decrypt(connection.accessToken);
        if (!accessToken) throw new Error("Falha ao desencriptar o token de acesso.");

        // Evitamos usar presigned URLs aqui caso o S3 falhe no upload e a aplicação sofra fallback para Local
        const { getFileBuffer } = await import('@/lib/s3');
        console.log(`[Media Handle] DB Key: ${asset.s3Key}`);

        console.log(`[Media Handle] Iniciando leitura agnóstica de Storage (ID: ${mediaId})...`);
        const downloadStart = Date.now();

        let fileBuffer: Buffer;
        try {
            fileBuffer = await getFileBuffer(companyId, asset.s3Key);
        } catch (downloadErr: any) {
            console.error(`[Media Handle] Falha fatal ao recuperar mídia (S3/Local): ${downloadErr.message}`);
            throw new Error(`Falha ao recuperar ficheiro da Storage: ${downloadErr.message}`);
        }

        const downloadDuration = Date.now() - downloadStart;
        console.log(`[Media Handle] Leitura de arquivo concluída: ${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)} MB em ${downloadDuration}ms`);

        console.log(`[Media Handle] Iniciando sessão de Resumable Upload na Meta Graph API...`);
        const sessionUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/uploads?file_length=${fileBuffer.byteLength}&file_type=${asset.mimeType || 'application/octet-stream'}`;
        
        const sessionStart = Date.now();
        const sessionResponse = await fetch(sessionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });
        const sessionData = await sessionResponse.json();
        
        if (!sessionResponse.ok) {
             console.error('Meta Media Session Error:', JSON.stringify(sessionData, null, 2));
             throw new Error(sessionData.error?.message || 'Falha ao criar sessão de upload na Meta.');
        }

        const sessionId = sessionData.id;
        console.log(`[Media Handle] Sessão criada: ${sessionId} em ${Date.now() - sessionStart}ms`);

        console.log(`[Media Handle] Iniciando upload binário para a sessão...`);
        const uploadUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${sessionId}`;
        
        const uploadStart = Date.now();
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${accessToken}`,
                'file_offset': '0'
            },
            body: fileBuffer,
            signal: AbortSignal.timeout(60000)
        });

        const uploadData = await uploadResponse.json();
        const uploadDuration = Date.now() - uploadStart;

        if (!uploadResponse.ok) {
            console.error('Meta Media Upload Error:', JSON.stringify(uploadData, null, 2));
            throw new Error(uploadData.error?.message || 'Falha ao fazer upload da mídia para a Meta.');
        }

        console.log(`[Media Handle] Upload concluído com sucesso em ${uploadDuration}ms. Handle: ${uploadData.h}`);

        const handle = uploadData.h;
        if (!handle) {
            throw new Error('Não foi possível obter o media handle (h) da resposta da Meta.');
        }

        const newHandle: MetaHandle = { wabaId, handle, createdAt: new Date().toISOString() };
        const updatedHandles = [...existingHandles, newHandle];

        // SECURITY: Validar tenant ao atualizar media asset
        await db.update(mediaAssets)
            .set({ metaHandles: updatedHandles })
            .where(and(
                eq(mediaAssets.id, mediaId),
                eq(mediaAssets.companyId, companyId)
            ));

        return NextResponse.json({ success: true, handle, message: 'Media handle criado com sucesso.' });

    } catch (error) {
        console.error('Erro ao processar media handle:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
