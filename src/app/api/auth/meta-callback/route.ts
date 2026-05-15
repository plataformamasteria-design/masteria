import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connections, marketingCredentials } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/automacoes?meta_error=${encodeURIComponent(error)}`, req.url));
    }
    if (!code) {
        return NextResponse.redirect(new URL('/automacoes?meta_error=no_code', req.url));
    }

    let companyId = '';
    let returnTo = '/automacoes';
    let originalBaseUrl = '';

    try {
        try {
            const decodedState = JSON.parse(Buffer.from(state || '', 'base64').toString('utf-8'));
            companyId = decodedState.companyId;
            if (decodedState.returnTo) returnTo = decodedState.returnTo;
            if (decodedState.baseUrl) originalBaseUrl = decodedState.baseUrl;
        } catch (e) {
            console.error("Invalid State Decode:", e);
        }

        if (!companyId) {
            throw new Error("Invalid Session State Validation");
        }

        let clientId = process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID || '1351722093634418';
        let clientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.INSTAGRAM_CLIENT_SECRET;

        // Check if company has custom app configuration
        const [marketingConf] = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'))
        ).limit(1);

        let customAppId = '';
        let customAppSecret = '';

        if (marketingConf && marketingConf.credentials) {
            const c = marketingConf.credentials as any;
            if (c.app_id && c.app_secret) {
                clientId = c.app_id;
                clientSecret = c.app_secret;
                customAppId = c.app_id;
                customAppSecret = c.app_secret;
            }
        }

        if (!clientSecret) {
            throw new Error("App Secret ausente na MasterIA e não configurado na conta.");
        }

        // 1. Usa estritamente a variável de originalBaseUrl capturada do front-end/headers para match idêntico no FB
        const baseUrl = originalBaseUrl || process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const redirectUri = `${baseUrl}/api/auth/meta-callback`;

        // 1. Troca o 'code' temporário por um token short-lived
        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`);
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            const errorDetails = tokenData.error ? tokenData.error.message : JSON.stringify(tokenData);
            console.error("Meta Token Exchange Failed:", tokenData);
            throw new Error(`Falha na geração do token Facebook: ${errorDetails}`);
        }

        // 2. Transforma o short-lived num token long-lived (Dura 60+ dias na Meta)
        const longTokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`);
        const longTokenData = await longTokenRes.json();
        const finalToken = longTokenData.access_token || tokenData.access_token;

        // 3. Apenas para dar um nome bonito na conexão
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${finalToken}`);
        const meData = await meRes.json();
        const configName = `Meta Auth - ${meData.name || 'Nova'}`;

        // 4. Armazena no BD como um Scaffold PENDING (Passo 2 do App Router lidará com a escolha de WABA)
        const encryptedToken = encrypt(finalToken);

        const [existingPending] = await db.select().from(connections)
            .where(and(
                eq(connections.wabaId, 'PENDING_OAUTH'),
                eq(connections.connectionType, 'meta_api'),
                eq(connections.companyId, companyId)
            )).limit(1);

        if (existingPending) {
            await db.update(connections).set({
                accessToken: encryptedToken,
                isActive: false,
                lastConnected: new Date()
            }).where(eq(connections.id, existingPending.id));
        } else {
            await db.insert(connections).values({
                companyId,
                config_name: configName,
                connectionType: 'meta_api',
                wabaId: 'PENDING_OAUTH',
                phoneNumberId: 'PENDING_OAUTH',
                appId: clientId,
                accessToken: encryptedToken,
                appSecret: encrypt(clientSecret),
                webhookSecret: uuidv4(),
                isActive: false,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
            });
        }

        // ---> SALVANDO SIMULTANEAMENTE PARA O DASHBOARD DE MARKETING <---
        const existingMarketing = await db.select().from(marketingCredentials).where(
            and(
                eq(marketingCredentials.companyId, companyId),
                eq(marketingCredentials.platform, 'meta')
            )
        ).limit(1);

        const credsObj: any = { access_token: finalToken };
        if (customAppId && customAppSecret) {
            credsObj.app_id = customAppId;
            credsObj.app_secret = customAppSecret;
        }

        if (existingMarketing.length > 0) {
            const currentCreds = (existingMarketing[0].credentials as any) || {};
            // Preserve existing app details if we didn't use custom ones just now
            if (!customAppId && currentCreds.app_id) credsObj.app_id = currentCreds.app_id;
            if (!customAppSecret && currentCreds.app_secret) credsObj.app_secret = currentCreds.app_secret;
            
            await db.update(marketingCredentials)
                .set({ credentials: { ...currentCreds, ...credsObj }, status: 'connected', updatedAt: new Date() })
                .where(eq(marketingCredentials.id, existingMarketing[0].id));
        } else {
            await db.insert(marketingCredentials).values({
                companyId,
                platform: 'meta',
                status: 'connected',
                credentials: credsObj
            });
        }

        // Devolve o usuário para a interface de onde ele iniciou o fluxo
        return NextResponse.redirect(`${baseUrl}${returnTo}?meta_oauth=success`);

    } catch (e: any) {
        console.error("Meta Callback Master Error:", e);
        // Opcional: Se der erro, devolve pra mesma view pra dar o feedback
        const backupBaseUrl = originalBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://masteria.app';
        const errorReturn = state ? JSON.parse(Buffer.from(state || '', 'base64').toString('utf-8')).returnTo || '/automacoes' : '/automacoes';
        return NextResponse.redirect(`${backupBaseUrl}${errorReturn}?meta_error=${encodeURIComponent(e.message)}`);
    }
}
