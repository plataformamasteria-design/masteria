import { config } from 'dotenv';
import Retell from 'retell-sdk';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

async function analyzeCalls() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n📊 ANÁLISE DE CHAMADAS RETELL\n');
  console.log('-------------------------------------------\n');

  const client = new Retell({
    apiKey: RETELL_API_KEY,
  });

  try {
    const calls = await client.call.list({ limit: 10 });

    console.log(`Total chamadas recentes: ${calls.length}\n`);

    for (let i = 0; i < Math.min(calls.length, 10); i++) {
      const call = calls[i];
      if (!call) continue;
      const duration = call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : 0;

      console.log(`[${i + 1}] ${call.call_id}`);
      console.log(`    Type: ${call.call_type || 'N/A'}`);
      console.log(`    Status: ${call.call_status}`);
      console.log(`    Duration: ${duration}s`);
      console.log(`    Disconnect: ${call.disconnection_reason || 'N/A'}`);
      console.log(`    From: ${(call as any).from_number || 'N/A'}`);
      console.log(`    To: ${(call as any).to_number || 'N/A'}`);
      console.log(`    Agent: ${call.agent_id}`);
      
      if (duration === 0 && call.call_status === 'ended') {
        console.log(`    ⚠️  PROBLEMA: Duração 0 - ${call.disconnection_reason}`);
      } else if (duration > 0) {
        console.log(`    ✅  OK: Chamada com ${duration}s de duração`);
      }
      console.log('');
    }

    // Separar por tipo
    const outboundCalls = calls.filter((c: any) => c.call_type === 'phone_call');
    const inboundCalls = calls.filter((c: any) => c.call_type === 'inbound_phone_call');
    const webCalls = calls.filter((c: any) => c.call_type === 'web_call');

    console.log('-------------------------------------------');
    console.log('\n📈 RESUMO:\n');
    console.log(`Outbound (phone_call): ${outboundCalls.length}`);
    console.log(`Inbound (inbound_phone_call): ${inboundCalls.length}`);
    console.log(`Web calls: ${webCalls.length}`);
    
    // Verificar sucesso
    const successfulCalls = calls.filter((c: any) => {
      const dur = c.end_timestamp && c.start_timestamp
        ? (c.end_timestamp - c.start_timestamp) / 1000
        : 0;
      return dur > 5;
    });

    console.log(`\nChamadas com duração > 5s: ${successfulCalls.length}`);

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

analyzeCalls().catch(console.error);
