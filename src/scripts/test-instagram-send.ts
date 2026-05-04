#!/usr/bin/env npx tsx
/**
 * Script de Teste - Envio de Mensagem Instagram via graph.instagram.com
 * Executa diretamente a lógica do sendInstagramMessage para verificar o endpoint
 */

import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

// Destinatário de teste - mesmo ID usado nos logs anteriores
const TEST_RECIPIENT_ID = '1896097054661185';
const TEST_MESSAGE = `Teste endpoint Instagram API - ${new Date().toISOString()}`;

async function main() {
    console.log('='.repeat(60));
    console.log('🧪 TESTE: Envio de Mensagem Instagram via graph.instagram.com');
    console.log('='.repeat(60));

    // 1. Buscar uma conexão Instagram ativa
    console.log('\n📡 Buscando conexão Instagram ativa...');
    const [connection] = await db.select().from(connections).where(
        and(
            eq(connections.connectionType, 'instagram_direct'),
            eq(connections.status, 'ACTIVE')
        )
    ).limit(1);

    if (!connection) {
        console.error('❌ Nenhuma conexão Instagram ativa encontrada');
        process.exit(1);
    }

    console.log(`✅ Conexão encontrada: ${connection.config_name}`);
    console.log(`   ID: ${connection.id}`);
    console.log(`   phoneNumberId (IG Account ID): ${connection.phoneNumberId}`);

    // 2. Obter o token
    if (!connection.accessToken) {
        console.error('❌ Token de acesso não encontrado');
        process.exit(1);
    }

    const accessToken = decrypt(connection.accessToken);
    console.log(`✅ Token: ${accessToken.substring(0, 20)}...`);

    const igAccountId = connection.phoneNumberId;
    if (!igAccountId) {
        console.error('❌ Instagram Account ID não configurado (phoneNumberId)');
        process.exit(1);
    }

    // 3. Preparar a chamada para o endpoint correto
    // CRITICAL: Using graph.instagram.com, NOT graph.facebook.com
    const url = `https://graph.instagram.com/${FACEBOOK_API_VERSION}/${igAccountId}/messages`;

    const payload = {
        recipient: { id: TEST_RECIPIENT_ID },
        message: { text: TEST_MESSAGE }
    };

    console.log('\n📤 Enviando requisição...');
    console.log(`   URL: ${url}`);
    console.log(`   Recipient: ${TEST_RECIPIENT_ID}`);
    console.log(`   Message: ${TEST_MESSAGE}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('\n📨 Resposta da API:');
        console.log(`   Status HTTP: ${response.status}`);
        console.log(`   Dados: ${JSON.stringify(data, null, 2)}`);

        if (response.ok && (data as any).message_id) {
            console.log('\n✅ SUCESSO! Mensagem enviada com sucesso!');
            console.log(`   Message ID: ${(data as any).message_id}`);
        } else {
            console.log('\n❌ FALHA! Erro ao enviar mensagem:');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('\n❌ ERRO na requisição:', error);
    }

    process.exit(0);
}

main();

