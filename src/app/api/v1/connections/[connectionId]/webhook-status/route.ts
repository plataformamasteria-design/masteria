// src/app/api/v1/connections/[connectionId]/webhook-status/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections, companies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { decrypt } from '@/lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        console.error("Falha ao obter o App Access Token:", data);
        throw new Error("Não foi possível obter o Token de Acesso do Aplicativo da Meta.");
    }
    return data.access_token;
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
    let currentConnectionId: string | undefined;
    try {
        const companyId = await getCompanyIdFromSession();
        const { connectionId } = await params;
        currentConnectionId = connectionId;

        const [connection] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.companyId, companyId)));
        if (!connection || !connection.appId) {
            return NextResponse.json({ error: 'Conexão ou App ID não encontrado.' }, { status: 404 });
        }

        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
        if (!company || !company.webhookSlug) {
            return NextResponse.json({ error: 'Configuração da empresa incompleta (slug do webhook ausente).' }, { status: 500 });
        }

        if (!connection.appSecret) {
            return NextResponse.json({ error: 'App Secret não configurado para esta conexão.' }, { status: 400 });
        }
        const appSecret = decrypt(connection.appSecret);
        if (!appSecret) {
            return NextResponse.json({ error: 'App Secret não encontrado ou falha na desencriptação.' }, { status: 400 });
        }

        const appAccessToken = await getAppAccessToken(connection.appId, appSecret);

        const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.appId}/subscriptions?access_token=${appAccessToken}&fields=object,callback_url,subscribed_fields`;

        const response = await fetch(url, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
            console.error("Erro ao buscar subscrição do webhook da Meta:", data);
            throw new Error(data.error?.message || 'Falha ao comunicar com a API da Meta.');
        }

        // CRITICAL FIX: Determine expected object type based on connection type
        let expectedObjectType = 'whatsapp_business_account';
        if (connection.connectionType === 'instagram' || connection.connectionType === 'instagram_direct') {
            expectedObjectType = 'instagram';
        }

        // Find the subscription matching our connection type
        const subscription = data.data?.find((sub: any) => sub.object === expectedObjectType);

        if (!subscription || !subscription.callback_url) {
            return NextResponse.json({ status: 'NAO_CONFIGURADO' });
        }

        // Get baseUrl from request headers to ensure it always matches the current environment
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const host = request.headers.get('host');
        let baseUrl = `${protocol}://${host}`;
        
        // Ensure https for production
        if (!baseUrl.startsWith('https://') && !baseUrl.includes('localhost')) {
            baseUrl = baseUrl.replace('http://', 'https://');
        }

        const expectedUrl = `${baseUrl}/api/webhooks/meta/${company.webhookSlug}`;
        const replitUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhooks/meta/${company.webhookSlug}` : null;
        const customUrl = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN ? `https://${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}/api/webhooks/meta/${company.webhookSlug}` : null;

        // Check if the configured URL matches ANY of our valid domains
        const isValid = subscription.callback_url === expectedUrl ||
            (replitUrl && subscription.callback_url === replitUrl) ||
            (customUrl && subscription.callback_url === customUrl);

        if (!isValid) {
            return NextResponse.json({
                status: 'DIVERGENTE',
                metaUrl: subscription.callback_url,
                expectedUrl,
                validUrls: [expectedUrl, replitUrl, customUrl].filter(Boolean)
            });
        }

        return NextResponse.json({ status: 'CONFIGURADO' });

    } catch (error) {
        console.error(`Erro ao verificar status do webhook para a conexão ${currentConnectionId || 'desconhecida'}:`, error);
        return NextResponse.json({ status: 'ERRO', error: (error as Error).message }, { status: 500 });
    }
}
