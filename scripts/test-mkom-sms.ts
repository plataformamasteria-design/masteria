import { config } from 'dotenv';
config();

const API_BASE = 'http://localhost:5000';

async function testMkomSms() {
    console.log('='.repeat(80));
    console.log('🧪 TESTE DE ENVIO SMS MKOM - EVIDÊNCIAS COMPLETAS');
    console.log('='.repeat(80));
    console.log(`📅 Data/Hora: ${new Date().toISOString()}`);
    console.log('');

    const listId = 'a4dddbb4-1beb-439e-8aad-1c7ec8b88a67';
    const listName = 'Lista Teste Normalização - 3 Contatos';
    
    console.log(`📋 Lista de Contatos: ${listName}`);
    console.log(`🔑 ID da Lista: ${listId}`);
    console.log('');

    const testMessage = `Teste MKOM ${new Date().toLocaleString('pt-BR')} - Sistema Master IA Oficial`;
    
    console.log('📨 Mensagem de Teste:');
    console.log(`   "${testMessage}"`);
    console.log('');

    try {
        console.log('📡 Endpoint da API interna:');
        console.log(`   POST ${API_BASE}/api/v1/sms/test-send`);
        console.log('');

        const response = await fetch(`${API_BASE}/api/v1/sms/test-send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                listId,
                message: testMessage,
                gatewayId: 'a4ef98bd-1b32-45ef-8803-e2f317b6da7d'
            })
        });

        const responseText = await response.text();
        console.log('📥 Response Status:', response.status, response.statusText);
        console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
        console.log('');
        
        try {
            const data = JSON.parse(responseText);
            console.log('📥 Response Body (JSON):');
            console.log(JSON.stringify(data, null, 2));
        } catch {
            console.log('📥 Response Body (Raw):');
            console.log(responseText);
        }

    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('FIM DO TESTE');
    console.log('='.repeat(80));
}

testMkomSms();
