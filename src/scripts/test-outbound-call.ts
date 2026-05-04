import { config } from 'dotenv';
import Retell from 'retell-sdk';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const FROM_NUMBER = '+553322980007';
const TO_NUMBER = '+5564999526870'; // Seu celular

async function testOutboundCall() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n📞 TESTE DE CHAMADA OUTBOUND VIA API\n');
  console.log('From:', FROM_NUMBER);
  console.log('To:', TO_NUMBER);
  console.log('-------------------------------------------\n');

  const client = new Retell({
    apiKey: RETELL_API_KEY,
  });

  try {
    console.log('📡 Iniciando chamada via API Retell...\n');

    const call = await client.call.createPhoneCall({
      from_number: FROM_NUMBER,
      to_number: TO_NUMBER,
    });

    console.log('✅ Chamada iniciada com sucesso!\n');
    console.log('Call ID:', call.call_id);
    console.log('Status:', call.call_status);
    console.log('Agent ID:', call.agent_id);
    console.log('');
    console.log('📱 Seu telefone deve tocar em alguns segundos...');
    console.log('');
    console.log('Aguarde a chamada e converse com o agente!');

  } catch (error: any) {
    console.error('❌ Erro ao iniciar chamada:', error.message);
    
    if (error.status) {
      console.error('Status:', error.status);
    }
    if (error.body) {
      console.error('Body:', JSON.stringify(error.body, null, 2));
    }
    if (error.error) {
      console.error('Error details:', error.error);
    }
  }
}

testOutboundCall().catch(console.error);
