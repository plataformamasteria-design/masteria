
// src/app/api/v1/conversations/start/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
    conversations,
    messages,
    contacts,
    templates,
    connections,
    mediaAssets,
    type MetaHandle
} from '@/lib/db/schema';
import type { MediaAsset as MediaAssetType, MetaApiMessageResponse } from '@/lib/types';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { sendWhatsappTemplateMessage } from '@/lib/facebookApiService';
import { z } from 'zod';

const startConversationSchema = z.object({
    contactId: z.string().uuid(),
    connectionId: z.string().uuid(),
    templateId: z.string().uuid(),
    variableMappings: z.record(z.any()),
    mediaAssetId: z.string().uuid().optional().nullable(),
});

async function getMediaData(assetId: string, connectionId: string, wabaId: string, companyId: string): Promise<{ handle: string; asset: MediaAssetType }> {
    // SECURITY: Validar tenant ao buscar media asset
    const [asset] = await db.select().from(mediaAssets).where(and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.companyId, companyId)
    ));
    if (!asset) {
        throw new Error(`Media Asset com ID ${assetId} não encontrado.`);
    }

    const existingHandles = (asset.metaHandles || []) as MetaHandle[];
    const existingHandle = existingHandles.find(h => h.wabaId === wabaId);
    if (existingHandle) {
        return { handle: existingHandle.handle, asset: asset as MediaAssetType };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:9002' : 'https://masteria.app');
    if (!baseUrl) {
        throw new Error("A variável de ambiente NEXT_PUBLIC_BASE_URL não está configurada.");
    }

    const handleResponse = await fetch(`${baseUrl}/api/v1/media/${assetId}/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
    });

    const handleData = await handleResponse.json() as { error?: string, handle?: string };
    if (!handleResponse.ok || !handleData.handle) {
        throw new Error(handleData.error || 'Falha ao obter o media handle da Meta.');
    }
    return { handle: handleData.handle, asset: asset as MediaAssetType };
}



// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json() as unknown;
        const parsed = startConversationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { contactId, connectionId, templateId, variableMappings, mediaAssetId } = parsed.data;

        // 1. Fetch all necessary data in parallel
        // SECURITY: Validar tenant em todas as queries
        const [contact] = await db.select().from(contacts).where(and(
            eq(contacts.id, contactId),
            eq(contacts.companyId, companyId)
        ));
        const [template] = await db.select().from(templates).where(and(
            eq(templates.id, templateId),
            eq(templates.companyId, companyId)
        ));
        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, connectionId),
            eq(connections.companyId, companyId)
        ));

        if (!contact) throw new Error("Contato não encontrado.");
        if (!template) throw new Error("Modelo não encontrado.");
        if (!connection) throw new Error("Conexão não encontrada.");

        // 2. Prepare template components
        const bodyVariables = template.body.match(/\{\{(\d+)\}\}/g) || [];
        const bodyParams = bodyVariables.map(placeholder => {
            const varKey = placeholder.replace(/\{|\}/g, '');
            const mapping = variableMappings[varKey];
            let text = `[variável ${varKey} não mapeada]`;

            if (mapping) {
                if (mapping.type === 'fixed') text = mapping.value;
                else if (mapping.type === 'dynamic') {
                    const dynamicValue = contact[mapping.value as keyof typeof contact];
                    if (dynamicValue !== null && dynamicValue !== undefined) text = String(dynamicValue);
                    else text = `[dado ausente]`;
                }
            }
            return { type: 'text', text };
        });

        const components: any[] = [];
        if (template.headerType && template.headerType !== 'NONE' && template.headerType !== 'TEXT') {
            if (!mediaAssetId) throw new Error("Este modelo requer um anexo de mídia.");
            if (!connection.wabaId) throw new Error("Conexão não possui WABA ID configurado.");
            // SECURITY: Passar companyId para validação de tenant
            const { handle, asset } = await getMediaData(mediaAssetId, connection.id, connection.wabaId, companyId);
            const headerType = template.headerType.toLowerCase() as 'image' | 'video' | 'document';

            const mediaObject: { id: string; filename?: string } = { id: handle };
            if (headerType === 'document' && asset.name) {
                mediaObject.filename = asset.name;
            }

            components.push({
                type: 'header',
                parameters: [{ type: headerType, [headerType]: mediaObject }]
            });
        }

        if (bodyParams.length > 0) {
            components.push({ type: 'body', parameters: bodyParams });
        }

        // 3. Send the message via Meta API
        const response = await sendWhatsappTemplateMessage({
            connectionId: connection.id,
            to: contact.phone,
            templateName: template.name,
            languageCode: template.language,
            components,
        });

        const sentMessageId = (response as unknown as MetaApiMessageResponse).messages?.[0]?.id;

        // 4. Find or Create Conversation and save message
        // SECURITY: Validar tenant ao buscar/conectar conversa existente
        const [conversation] = await db.transaction(async (tx) => {
            let [existingConversation] = await tx
                .select()
                .from(conversations)
                .where(and(
                    eq(conversations.contactId, contact.id),
                    eq(conversations.connectionId, connection.id),
                    eq(conversations.companyId, companyId)
                ));

            if (existingConversation) {
                // SECURITY: Validar tenant ao atualizar conversa
                const [updatedConvo] = await tx.update(conversations).set({
                    lastMessageAt: new Date(),
                    status: 'IN_PROGRESS',
                    archivedAt: null,
                    archivedBy: null,
                }).where(and(
                    eq(conversations.id, existingConversation.id),
                    eq(conversations.companyId, companyId)
                )).returning();
                existingConversation = updatedConvo;
            } else {
                [existingConversation] = await tx.insert(conversations).values({
                    companyId: companyId,
                    contactId: contact.id,
                    connectionId: connection.id,
                    status: 'IN_PROGRESS' // Starts as in progress since we sent the first message
                }).returning();
            }

            if (!existingConversation) {
                throw new Error("Falha ao criar ou atualizar a conversa na transação.");
            }

            await tx.insert(messages).values({
                companyId: existingConversation.companyId,
                conversationId: existingConversation.id,
                providerMessageId: sentMessageId,
                senderType: 'AGENT',
                content: `Template: ${template.name}`,
                contentType: 'TEXT',
                status: 'SENT',
                sentAt: new Date(),
            });

            return [existingConversation];
        });

        if (!conversation) {
            throw new Error("Falha ao obter a conversa após a transação.");
        }

        return NextResponse.json({ success: true, conversationId: conversation.id });

    } catch (error) {
        console.error("Erro ao iniciar conversa:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
