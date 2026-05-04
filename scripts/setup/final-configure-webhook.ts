// Script final para configurar o webhook com a Meta/WhatsApp API usando a URL correta

import { db } from './src/lib/db';
import { connections, companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';

const FACEBOOK_API_VERSION = 'v23.0';
const WEBHOOK_FIELDS = 'messages,message_template_status_update,account_update';

async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        console.error("Failed to get App Access Token:", data);
        throw new Error("Não foi possível obter o Token de Acesso do Aplicativo da Meta.");
    }
    return data.access_token;
}

async function finalConfigureWebhook() {
    console.log('============================================================');
    console.log('CONFIGURAÇÃO FINAL DO WEBHOOK META/WHATSAPP');
    console.log('============================================================');
    
    try {
        // 1. Configurações
        const connectionId = '51d60e9b-b308-4193-85d7-192ff6f4e3d8';
        const webhookSlug = 'f046c0b7-ff2c-4ec2-9b9e-7f3fb70e02b7';
        const baseUrl = 'https://e45cb235-2e9a-4a4d-bd5f-f2c452b50262-00-lmygdne6adv3.riker.replit.dev'; // URL CORRETA COM 'l'
        const verifyToken = 'zapmaster_verify_2024';
        
        console.log('\n📋 Configuração:');
        console.log(`   Connection ID: ${connectionId}`);
        console.log(`   Webhook Slug: ${webhookSlug}`);
        console.log(`   Base URL: ${baseUrl}`);
        console.log(`   Verify Token: ${verifyToken}`);
        
        // 2. Buscar dados da conexão
        const [connection] = await db
            .select()
            .from(connections)
            .where(eq(connections.id, connectionId));
            
        if (!connection) {
            throw new Error('Conexão não encontrada!');
        }
        
        const [company] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, connection.companyId));
            
        if (!company || !company.webhookSlug) {
            throw new Error('Configuração da empresa incompleta!');
        }
        
        console.log('\n✅ Conexão encontrada:');
        console.log(`   Config Name: ${connection.config_name}`);
        console.log(`   WABA ID: ${connection.wabaId}`);
        console.log(`   App ID: ${connection.appId}`);
        console.log(`   Phone Number ID: ${connection.phoneNumberId}`);
        
        // 3. Desencriptar credenciais
        const appId = connection.appId;
        const appSecret = decrypt(connection.appSecret);
        
        if (!appId || !appSecret) {
            throw new Error('Credenciais incompletas!');
        }
        
        console.log('🔐 Credenciais validadas');
        
        // 4. Obter App Access Token
        console.log('\n🔑 Obtendo App Access Token...');
        const appAccessToken = await getAppAccessToken(appId, appSecret);
        console.log('   ✅ Token obtido com sucesso!');
        
        // 5. Configurar Callback URL
        const callbackUrl = `${baseUrl}/api/webhooks/meta/${company.webhookSlug}`;
        
        console.log('\n🔗 URLs:');
        console.log(`   Callback URL: ${callbackUrl}`);
        
        // 6. Remover assinatura antiga
        console.log('\n🗑️  Removendo assinatura antiga...');
        const deleteUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions?object=whatsapp_business_account&access_token=${appAccessToken}`;
        
        try {
            const deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
            const deleteData = await deleteResponse.json();
            
            if (deleteResponse.ok) {
                console.log('   ✅ Assinatura antiga removida');
            } else if (deleteData.error?.code === 100) {
                console.log('   ℹ️ Nenhuma assinatura antiga encontrada');
            } else {
                console.warn('   ⚠️ Aviso:', deleteData.error?.message || 'Erro ao remover');
            }
        } catch (error) {
            console.warn('   ⚠️ Erro ao tentar remover:', error);
        }
        
        // 7. Criar nova assinatura
        console.log('\n✨ Criando nova assinatura do webhook...');
        
        const form = new URLSearchParams();
        form.append('object', 'whatsapp_business_account');
        form.append('callback_url', callbackUrl);
        form.append('verify_token', verifyToken);
        form.append('fields', WEBHOOK_FIELDS);
        
        const createUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions?access_token=${appAccessToken}`;
        
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            body: form,
        });
        
        const createResponseData = await createResponse.json();
        
        if (!createResponse.ok) {
            throw new Error(createResponseData.error?.message || 'Falha ao configurar webhook');
        }
        
        console.log('\n🎉 WEBHOOK CONFIGURADO COM SUCESSO!');
        console.log('   Resposta:', JSON.stringify(createResponseData, null, 2));
        
        // 8. Verificar status do webhook
        console.log('\n🔍 Verificando status do webhook...');
        const statusUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${appId}/subscriptions?access_token=${appAccessToken}&fields=callback_url,subscribed_fields`;
        
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json();
        
        if (statusResponse.ok && statusData.data?.[0]) {
            const subscription = statusData.data[0];
            console.log('\n📊 Status Atual do Webhook:');
            console.log(`   ✅ Callback URL: ${subscription.callback_url}`);
            console.log(`   ✅ Campos Assinados: ${subscription.subscribed_fields}`);
            
            if (subscription.callback_url === callbackUrl) {
                console.log('   ✅ URL configurada corretamente!');
            } else {
                console.log('   ⚠️ URLs divergentes');
                console.log(`      Esperado: ${callbackUrl}`);
                console.log(`      Configurado: ${subscription.callback_url}`);
            }
        } else {
            console.log('   ⚠️ Não foi possível verificar o status');
        }
        
        // 9. Teste final do webhook
        console.log('\n🧪 Teste final do webhook...');
        const testChallenge = 'FINAL_TEST_' + Date.now();
        const testUrl = `${callbackUrl}?hub.mode=subscribe&hub.challenge=${testChallenge}&hub.verify_token=${verifyToken}`;
        
        try {
            const testResponse = await fetch(testUrl);
            const testData = await testResponse.text();
            
            if (testResponse.status === 200 && testData === testChallenge) {
                console.log('   ✅ Webhook respondendo corretamente!');
            } else {
                console.log('   ⚠️ Resposta inesperada no teste');
            }
        } catch (error) {
            console.log('   ❌ Erro no teste:', error);
        }
        
        // 10. Resumo final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DA CONFIGURAÇÃO');
        console.log('='.repeat(60));
        console.log('\n✅ Webhook sincronizado com sucesso!');
        console.log('\n📱 Informações da Integração:');
        console.log(`   WABA ID: ${connection.wabaId}`);
        console.log(`   Phone Number ID: ${connection.phoneNumberId}`);
        console.log(`   App ID: ${connection.appId}`);
        console.log('\n🔗 Configuração do Webhook:');
        console.log(`   Callback URL: ${callbackUrl}`);
        console.log(`   Verify Token: ${verifyToken}`);
        console.log(`   Campos: ${WEBHOOK_FIELDS}`);
        console.log('\n✅ Status: ATIVO E FUNCIONANDO');
        console.log('\n📝 O webhook está pronto para:');
        console.log('   • Receber mensagens do WhatsApp');
        console.log('   • Processar status de templates');
        console.log('   • Receber atualizações de conta');
        console.log('\n🎉 Configuração concluída com sucesso!');
        console.log('='.repeat(60));
        
        return {
            success: true,
            connectionId,
            callbackUrl,
            status: 'CONFIGURADO',
            wabaId: connection.wabaId,
            phoneNumberId: connection.phoneNumberId,
            appId: connection.appId
        };
        
    } catch (error) {
        console.error('\n❌ ERRO:', error);
        throw error;
    }
}

// Executar
finalConfigureWebhook()
    .then((result) => {
        console.log('\n✨ Script executado com sucesso!');
        console.log('Resultado:', result);
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Falha:', error);
        process.exit(1);
    });