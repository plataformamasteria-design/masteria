import { evolutionApiService } from './src/services/evolution-api.service';

async function testSend() {
    const connId = '2fe3c4ff-4ac3-4d09-b6b9-1e15524b70e2'; // Camila (Connected)
    
    const number1 = '5588920008007'; // Com o 9
    const number2 = '558820008007'; // Sem o 9
    
    console.log(`Verificando o status da conexão antes de enviar...`);
    try {
        const state = await evolutionApiService.getConnectionState(connId);
        console.log(`Status: ${state?.instance?.state}`);
        
        if (state?.instance?.state !== 'open') {
            console.log('A conexão ainda não está "open". A mensagem pode falhar, mas vamos tentar.');
        }
    } catch (e) {
        console.error('Erro ao verificar status:', e);
    }
    
    console.log(`\nTentando enviar para ${number1} (com o 9)...`);
    try {
        const res = await evolutionApiService.sendMessage(connId, number1, 'Teste de conexão Masteria - Mensagem com 9 dígitos');
        console.log('Sucesso!', res);
    } catch (e) {
        console.error('Falha:', e);
    }
    
    console.log(`\nTentando enviar para ${number2} (sem o 9)...`);
    try {
        const res = await evolutionApiService.sendMessage(connId, number2, 'Teste de conexão Masteria - Mensagem sem 9 dígitos');
        console.log('Sucesso!', res);
    } catch (e) {
        console.error('Falha:', e);
    }
}

testSend().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
