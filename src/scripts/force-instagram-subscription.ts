
import { db } from '../lib/db';
import { connections, companies } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

// Force subscription to 'messages' field for Instagram
async function forceSubscribeInstagram() {
    console.log('🚀 Iniciando Forçamento de Assinatura de Webhook (Instagram) [via Fetch]...');

    // ... env vars ...
    const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
    const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
    const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
    const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

    // Use current environment's DATABASE_URL loaded by dotenv
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL missing.");
        process.exit(1);
    }

    // 1. Get Connection to find Company
    const [connection] = await db.select().from(connections).where(eq(connections.connectionType, 'instagram')).limit(1);

    if (!connection) {
        console.error('❌ ERRO: Nenhuma conexão Instagram encontrada no banco para extrair o Slug.');
        process.exit(1);
    }

    // 2. Get Company to get Slug
    const [company] = await db.select().from(companies).where(eq(companies.id, connection.companyId)).limit(1);

    if (!company) {
        console.error('❌ ERRO: Companhia não encontrada para a conexão.');
        process.exit(1);
    }

    const webhookSlug = company.webhookSlug;
    if (!webhookSlug) {
        console.error('❌ ERRO: Companhia encontrada, mas sem webhookSlug.');
        process.exit(1);
    }

    // Construct Default URL (Fallback)
    const baseUrl = REPLIT_DEV_DOMAIN
        ? `https://${REPLIT_DEV_DOMAIN}`
        : NEXT_PUBLIC_BASE_URL;

    const defaultCallbackUrl = `${baseUrl}/api/webhooks/meta/${webhookSlug}`;
    const verifyToken = process.env.META_VERIFY_TOKEN || 'masteria_secure_token_2025';

    console.log(`\n📋 Configuração Detectada:`);
    console.log(`   - App ID: ${FACEBOOK_CLIENT_ID}`);
    console.log(`   - Default Callback URL: ${defaultCallbackUrl}`);
    console.log(`   - Verify Token: ${verifyToken}`);

    // 1. Get App Access Token (Client Credentials)
    console.log(`\n🔑 Obtendo App Access Token...`);
    let appAccessToken = '';
    try {
        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FACEBOOK_CLIENT_ID}&client_secret=${FACEBOOK_CLIENT_SECRET}&grant_type=client_credentials`);
        const data = await tokenRes.json();

        if (!tokenRes.ok) throw new Error(JSON.stringify(data));

        appAccessToken = data.access_token;
        console.log('   ✅ Token obtido com sucesso!');
    } catch (error: any) {
        console.error('   ❌ Falha ao obter token:', error.message);
        process.exit(1);
    }

    // 2. Check Existing Subscription
    console.log(`\n🔍 Verificando assinatura atual...`);
    let currentCallbackUrl = null;
    try {
        const checkRes = await fetch(`https://graph.facebook.com/v19.0/${FACEBOOK_CLIENT_ID}/subscriptions?access_token=${appAccessToken}`);
        const data = await checkRes.json();

        if (!checkRes.ok) throw new Error(JSON.stringify(data));

        const subscriptions = data.data;
        const instaSub = subscriptions.find((s: any) => s.object === 'instagram');

        if (instaSub) {
            console.log("   ✅ Assinatura 'instagram' encontrada!");
            console.log(`   - URL Atual: ${instaSub.callback_url}`);
            console.log(`   - Campos Atuais: ${JSON.stringify(instaSub.fields)}`);
            currentCallbackUrl = instaSub.callback_url;
        } else {
            console.log("   ⚠️ Nenhuma assinatura 'instagram' ativa encontrada.");
        }

    } catch (error: any) {
        console.error('   ❌ Falha ao checar assinatura:', error.message);
    }

    // Use existing URL if found (SAFEST), otherwise default
    // CRITICAL: We DO NOT want to change the URL if it's already working but just missing fields.
    // However, if it's missing, we MUST have a valid default.

    let finalCallbackUrl = currentCallbackUrl;

    if (!finalCallbackUrl) {
        if (defaultCallbackUrl && !defaultCallbackUrl.includes('undefined')) {
            console.log(`   ℹ️ Usando Default URL gerada: ${defaultCallbackUrl}`);
            finalCallbackUrl = defaultCallbackUrl;
        } else {
            console.error("❌ ERRO: Não há assinatura ativa E não consegui gerar URL válida (falta domínio).");
            process.exit(1);
        }
    }

    console.log(`\n📡 Forçando assinatura para 'instagram' object...`);
    console.log(`   URL Alvo: ${finalCallbackUrl}`);

    try {
        const formData = new URLSearchParams();
        formData.append('object', 'instagram');
        formData.append('callback_url', finalCallbackUrl);
        formData.append('fields', 'messages,messaging_postbacks,message_reactions,mentions,comments');
        formData.append('verify_token', verifyToken);
        formData.append('access_token', appAccessToken);

        const subscribeRes = await fetch(`https://graph.facebook.com/v19.0/${FACEBOOK_CLIENT_ID}/subscriptions`, {
            method: 'POST',
            body: formData
        });

        const data = await subscribeRes.json();

        if (!subscribeRes.ok) {
            throw new Error(JSON.stringify(data));
        }

        console.log('   ✅ Assinatura ATUALIZADA com sucesso!');
        console.log('   Resposta:', data);

    } catch (error: any) {
        console.error('   ❌ Falha ao assinar webhook:', error.message);
        if (error.message.includes("Challenge")) {
            console.log('\n⚠️ ERRO DE CHALLENGE: O servidor no Replit precisa estar RODANDO para responder ao desafio da Meta.');
            console.log("   Certifique-se de que o servidor (Next.js) está ativo e acessível na URL acima.");
        }
    }
}

forceSubscribeInstagram().catch(console.error);
