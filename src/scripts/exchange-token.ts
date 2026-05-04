
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '../lib/crypto';

// CONFIGURATION
const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const CONNECTION_ID = 'c025e687-29eb-4589-b257-13c1349db630'; // ID from previous debugging
// PASTE YOUR SHORT LIVED TOKEN HERE FROM GRAPH EXPLORER
const SHORT_LIVED_TOKEN = '';

async function main() {
    if (!SHORT_LIVED_TOKEN) {
        console.error('❌ ERRO: Você precisa colar o token de curta duração na variável SHORT_LIVED_TOKEN dentro do script.');
        console.log('Obtenha em: https://developers.facebook.com/tools/explorer/');
        return;
    }

    if (!APP_ID || !APP_SECRET) {
        console.error('❌ ERRO: Variáveis de ambiente META_APP_ID ou META_APP_SECRET não encontradas.');
        return;
    }

    console.log(`🔄 Trocando token curto por longo para a conexão: ${CONNECTION_ID}`);

    // 1. Exchange Token
    const exchangeUrl = `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`;

    try {
        const res = await fetch(exchangeUrl);
        const data = await res.json();

        if (data.error) {
            console.error('❌ Erro da Meta API:', data.error);
            return;
        }

        const longLivedToken = data.access_token;
        const expiresIn = data.expires_in; // Seconds

        if (!longLivedToken) {
            console.error('❌ A resposta da API não conteve um access_token longo.');
            return;
        }

        console.log('✅ Token de longa duração gerado com sucesso!');
        console.log(`⏳ Expira em: ${expiresIn ? (expiresIn / 86400).toFixed(2) + ' dias' : 'Nunca/Indefinido'}`);

        // 2. Update Database
        const encryptedToken = encrypt(longLivedToken);
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

        await db.update(connections)
            .set({
                accessToken: encryptedToken,
                tokenExpiresAt: expiresAt,
                tokenLastRefreshed: new Date(),
                isActive: true // Re-activate
            })
            .where(eq(connections.id, CONNECTION_ID));

        console.log('💾 Banco de dados atualizado com sucesso!');
        console.log('🚀 A conexão deve estar ativa agora.');

    } catch (error) {
        console.error('❌ Erro de execução:', error);
    }
}

main().catch(console.error).finally(() => process.exit(0));
