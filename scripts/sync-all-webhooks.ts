import { config } from 'dotenv';
config({ path: '.env.local' }); // Mocks the local env

import { db } from '../src/lib/db';
import { connections, companies } from '../src/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { decrypt, encrypt } from '../src/lib/crypto';
import fetch from 'node-fetch';

const FACEBOOK_API_VERSION = 'v24.0';
const WA_WEBHOOK_FIELDS = 'messages,message_template_status_update,account_update';
const IG_WEBHOOK_FIELDS = 'messages,messaging_postbacks,message_reactions,messaging_seen';

const NEW_BASE_URL = 'https://masteria-production.up.railway.app';
// Mocks token from secrets if not loaded
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'masteria_secure_verify_token_2025_v2';

async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId.trim()}&client_secret=${appSecret.trim()}&grant_type=client_credentials`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        throw new Error(`Na API Meta: ${data.error?.message || JSON.stringify(data)}`);
    }
    return data.access_token;
}

async function run() {
    console.log(`[SYNC WEBHOOKS] Iniciando sincronização global em massa para o Domínio: ${NEW_BASE_URL}...`);

    // 1. Fetch all companies that have a webhookSlug
    const allCompanies = await db.select().from(companies).where(isNotNull(companies.webhookSlug));
    console.log(`[SYNC WEBHOOKS] Encontradas ${allCompanies.length} empresas com slug configurado.`);

    let successCount = 0;
    let failCount = 0;

    for (const company of allCompanies) {
        const companyConnections = await db.select().from(connections).where(eq(connections.companyId, company.id));

        // Filter out connections that aren't Meta-based (e.g. Baileys)
        const metaConnections = companyConnections.filter(c =>
            c.connectionType !== 'baileys' && c.appId && c.appSecret
        );

        if (metaConnections.length === 0) continue;

        console.log(`\n======================================================`);
        console.log(`[Companhia] ${company.name} | [Slug] ${company.webhookSlug}`);
        console.log(`Processando ${metaConnections.length} conexões Meta detectadas...`);

        for (const conn of metaConnections) {
            try {
                const appSecretDecrypted = decrypt(conn.appSecret!);
                if (!appSecretDecrypted) throw new Error("Falha ao descriptografar o App Secret.");

                const appAccessToken = await getAppAccessToken(conn.appId!, appSecretDecrypted);

                const callbackUrl = `${NEW_BASE_URL}/api/webhooks/meta/${company.webhookSlug}`;

                let targetObject = 'whatsapp_business_account';
                let targetFields = WA_WEBHOOK_FIELDS;

                if (conn.connectionType === 'instagram' || conn.connectionType === 'instagram_direct') {
                    targetObject = 'instagram';
                    targetFields = IG_WEBHOOK_FIELDS;
                }

                console.log(`  -> Sincronizando conexão id: ${conn.id} (${targetObject})`);

                // Excluir Antiga
                const deleteUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.appId}/subscriptions?object=${targetObject}&access_token=${appAccessToken}`;
                await fetch(deleteUrl, { method: 'DELETE' });

                // Criar Nova
                const form = new URLSearchParams();
                form.append('object', targetObject);
                form.append('callback_url', callbackUrl);
                form.append('verify_token', META_VERIFY_TOKEN);
                form.append('fields', targetFields);

                const createUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.appId}/subscriptions?access_token=${appAccessToken}`;
                const createResponse = await fetch(createUrl, {
                    method: 'POST',
                    body: form,
                });

                const createResponseData = await createResponse.json();

                if (!createResponse.ok) {
                    throw new Error(createResponseData.error?.message || "Falha desconhecida via Meta API.");
                }

                console.log(`     [OK] Sucesso! Meta agora aponta para o novo endereço da Railway.`);
                successCount++;
            } catch (err: any) {
                console.log(`     [ERRO] Falha ao sincronizar conexão ${conn.id}: ${err.message}`);
                failCount++;
            }
        }
    }

    console.log(`\n======================================================`);
    console.log(`[RESULTADO FINAL]`);
    console.log(`Sucessos: ${successCount}`);
    console.log(`Falhas: ${failCount}`);
    console.log(`Todas as chaves foram processadas nativamente Pelo Backend.`);
    process.exit(0);
}

run().catch(console.error);
