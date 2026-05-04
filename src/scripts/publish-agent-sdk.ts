import { config } from 'dotenv';
import Retell from 'retell-sdk';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';

async function publishAgentWithSDK() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n🔧 PUBLICANDO AGENTE VIA SDK OFICIAL RETELL\n');
  console.log('Agent ID:', AGENT_ID);
  console.log('-------------------------------------------\n');

  const client = new Retell({
    apiKey: RETELL_API_KEY,
  });

  try {
    // Get current agent state
    console.log('📋 Estado atual do agente...\n');
    const currentAgent = await client.agent.retrieve(AGENT_ID);
    console.log('Nome:', currentAgent.agent_name);
    console.log('Versão:', currentAgent.version);
    console.log('Publicado:', currentAgent.is_published);
    console.log('');

    // Try to update with is_published: true
    console.log('📡 Tentando publicar via SDK update()...\n');
    
    const updatedAgent = await client.agent.update(AGENT_ID, {
      is_published: true,
    } as any);

    console.log('Resposta do SDK:');
    console.log('Nome:', updatedAgent.agent_name);
    console.log('Versão:', updatedAgent.version);
    console.log('Publicado:', updatedAgent.is_published);
    console.log('');

    if (updatedAgent.is_published) {
      console.log('🎉 SUCESSO! Agente publicado via SDK!');
    } else {
      console.log('❌ Agente ainda não publicado após SDK update');
      console.log('');
      console.log('Tentando outras propriedades...');
      
      // Try with additional properties
      const attempt2 = await client.agent.update(AGENT_ID, {
        agent_name: currentAgent.agent_name,
        is_published: true,
      } as any);
      
      console.log('Tentativa 2 - Publicado:', attempt2.is_published);
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    
    if (error.status) {
      console.error('Status:', error.status);
    }
    if (error.body) {
      console.error('Body:', JSON.stringify(error.body, null, 2));
    }
  }

  // Verify final state
  console.log('\n📋 Verificação final...\n');
  const finalAgent = await client.agent.retrieve(AGENT_ID);
  console.log('Nome:', finalAgent.agent_name);
  console.log('Versão:', finalAgent.version);
  console.log('Publicado:', finalAgent.is_published ? '✅ SIM' : '❌ NÃO');
}

publishAgentWithSDK().catch(console.error);
