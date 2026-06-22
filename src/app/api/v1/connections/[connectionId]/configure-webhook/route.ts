// src/app/api/v1/connections/[connectionId]/configure-webhook/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections, companies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { decrypt } from '@/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

// Webhook Fields Definitions
const WA_WEBHOOK_FIELDS = 'messages,message_template_status_update,account_update';
const IG_WEBHOOK_FIELDS = 'messages,messaging_postbacks,message_reactions,messaging_seen';

/**
 * Obtém um App Access Token da Meta, que é necessário para gerir subscrições de webhook.
 */
async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId.trim()}&client_secret=${appSecret.trim()}&grant_type=client_credentials`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.access_token) {
            console.error("Failed to get App Access Token:", data);
            const errorMsg = data.error?.message || JSON.stringify(data);
            throw new Error(`Não foi possível obter o Token de Acesso da Meta: ${errorMsg}`);
        }
        return data.access_token;
    } catch (e: any) {
        console.error("Network error fetching App Access Token:", e);
        throw new Error(`Erro de rede ao buscar Token da Meta: ${e.message}`);
    }
}

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;

        // 1. Buscar a conexão e a empresa associada
        const [connection] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.companyId, companyId)));
        if (!connection) {
            return NextResponse.json({ error: 'Conexão não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        if (!company || !company.webhookSlug) {
            return NextResponse.json({ error: 'Configuração da empresa incompleta (slug do webhook ausente).' }, { status: 500 });
        }

        // =================================================================
        // BRANCH EVOLUTION API / BAILEYS
        // =================================================================
        if (connection.connectionType === 'evolution' || connection.connectionType === 'baileys') {
            let baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
            if (!baseUrl) {
                const protocol = request.headers.get('x-forwarded-proto') || 'https';
                const host = request.headers.get('host');
                baseUrl = `${protocol}://${host}`;
            }

            if (!baseUrl.startsWith('https://') && !baseUrl.includes('localhost')) {
                baseUrl = baseUrl.replace('http://', 'https://');
            }

            const webhookUrl = `${baseUrl}/api/v1/webhooks/evolution`;
            
            try {
                const { evolutionApiService } = require('@/services/evolution-api.service');
                await evolutionApiService.setWebhook(connection.id, webhookUrl);

                // Sincronizar nome e foto do perfil
                try {
                    const instancesData = await evolutionApiService.fetchAllInstances();
                    const instance = instancesData.find((inst: any) => inst.name === connection.id || inst.instanceName === connection.id);
                    if (instance && (instance.profileName || instance.profilePicUrl)) {
                        await db.update(connections).set({
                            profileName: instance.profileName,
                            profilePicUrl: instance.profilePicUrl
                        }).where(eq(connections.id, connection.id));
                    }
                } catch (syncErr) {
                    console.log(`[Webhook Sync] Aviso: Não foi possível extrair dados do perfil para ${connection.id}:`, syncErr);
                }

                return NextResponse.json({ 
                    success: true, 
                    message: `Webhook (Evolution API) atualizado com sucesso! Domínio atual: ${webhookUrl}`,
                    webhookUrl
                });
            } catch (err: any) {
                return NextResponse.json({ error: `Falha ao configurar webhook Evolution: ${err.message}` }, { status: 500 });
            }
        }

        // =================================================================
        // BRANCH META API
        // =================================================================
        // 2. Desencriptar as credenciais
        const appId = connection.appId;
        if (!connection.appSecret) {
            return NextResponse.json({ error: 'App Secret não configurado para esta conexão.' }, { status: 400 });
        }
        const appSecret = decrypt(connection.appSecret);

        if (!appId || !appSecret) {
            return NextResponse.json({ error: 'Credenciais da conexão (App ID ou App Secret) estão incompletas ou corrompidas.' }, { status: 400 });
        }

        // 3. Obter o App Access Token
        const appAccessToken = await getAppAccessToken(appId, appSecret);

        // ✅ P6 FIX: Usar variável de ambiente como URL primária (mais confiável que headers HTTP atrás de proxy)
        let baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
        if (!baseUrl) {
            // Fallback: construir a partir dos headers (menos confiável em Railway/Vercel)
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('host');
            baseUrl = `${protocol}://${host}`;
            console.warn(`[Webhook Config] ⚠️ APP_URL não configurada. Usando header: ${baseUrl}`);
        }

        if (!baseUrl.startsWith('https://') && !baseUrl.includes('localhost')) {
            baseUrl = baseUrl.replace('http://', 'https://');
        }

        const callbackUrl = `${baseUrl}/api/webhooks/meta/${company.webhookSlug}`;
        // Fallback to strict hardcoded token if env var is missing or empty on Railway
        const verifyToken = process.env.META_VERIFY_TOKEN || 'masteria_secure_token_2025';

        console.log(`[Webhook Config] Base URL: ${baseUrl}`);
        console.log(`[Webhook Config] Webhook Slug: ${company.webhookSlug}`);
        console.log(`[Webhook Config] Callback URL completa: ${callbackUrl}`);
        console.log(`[Webhook Config] Connection Type: ${connection.connectionType}`);

        // Determine Object and Fields based on Connection Type
        let targetObject = 'whatsapp_business_account';
        let targetFields = WA_WEBHOOK_FIELDS;

        if (connection.connectionType === 'instagram' || connection.connectionType === 'instagram_direct') {
            targetObject = 'instagram';
            targetFields = IG_WEBHOOK_FIELDS;
        }

        // =================================================================
        // PASSO 5: EXCLUIR ASSINATURA ANTIGA (GARANTIR UM ESTADO LIMPO)
        // =================================================================
        console.log(`[Webhook Sync] Tentando excluir assinatura antiga (${targetObject}) para o App ID: ${appId}`);
        const deleteUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions?object=${targetObject}&access_token=${appAccessToken}`;
        const deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });

        const deleteData = await deleteResponse.json();
        if (!deleteResponse.ok && deleteData.error?.code !== 100) {
            console.warn(`[Webhook Sync] Não foi possível excluir a assinatura antiga (${targetObject}):`, deleteData);
        } else {
            console.log(`[Webhook Sync] Resposta da exclusão (${targetObject}):`, deleteData);
        }

        // =================================================================
        // PASSO 6: CRIAR NOVA ASSINATURA
        // =================================================================
        const form = new URLSearchParams();
        form.append('object', targetObject);
        form.append('callback_url', callbackUrl);
        form.append('verify_token', verifyToken);
        form.append('fields', targetFields);

        console.log(`[Webhook Sync] Criando nova assinatura para ${targetObject} com campos: ${targetFields}`);

        const createUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions?access_token=${appAccessToken}`;

        const createResponse = await fetch(createUrl, {
            method: 'POST',
            body: form,
        });

        const createResponseData = await createResponse.json();

        if (!createResponse.ok) {
            console.error(`Meta Webhook Subscription Error (${targetObject}):`, createResponseData);
            throw new Error(createResponseData.error?.message || `Falha ao configurar a subscrição do webhook (${targetObject}) na Meta.`);
        }

        console.log(`[Webhook Sync] Sucesso (${targetObject}):`, createResponseData);

        // --- FETCH PROFILE DATA PARA META API E INSTAGRAM ---
        try {
            if (connection.phoneNumberId && connection.accessToken) {
                const userToken = decrypt(connection.accessToken);
                let picUrl: string | undefined = undefined;
                let profileName: string | undefined = undefined;

                if (targetObject === 'whatsapp_business_account') {
                    // WhatsApp Cloud API
                    const profileUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`;
                    const profileRes = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${userToken}` } });
                    const profileData = await profileRes.json();
                    picUrl = profileData?.data?.[0]?.profile_picture_url;
                } else if (targetObject === 'instagram') {
                    // Instagram Graph API
                    const profileUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}?fields=profile_picture_url,name,username`;
                    const profileRes = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${userToken}` } });
                    const profileData = await profileRes.json();
                    picUrl = profileData?.profile_picture_url;
                    profileName = profileData?.name || profileData?.username;
                }

                if (picUrl || profileName) {
                    await db.update(connections).set({
                        profilePicUrl: picUrl || null,
                        profileName: profileName || null,
                    }).where(eq(connections.id, connection.id));
                }
            }
        } catch(e) {
            console.warn("[Webhook Sync] Aviso: Não foi possível extrair dados do perfil Meta/IG para", connection.id, e);
        }
        // ----------------------------------------------------

        return NextResponse.json({ success: true, message: `Webhook (${targetObject}) configurado e sincronizado com a Meta com sucesso!` });

    } catch (error) {
        console.error('Erro ao configurar webhook:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
