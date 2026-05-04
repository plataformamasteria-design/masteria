import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const TARGET_NUMBER = '+553322980007';

async function createPublishedAgent() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n🔧 CRIAR NOVO AGENTE JÁ PUBLICADO\n');
  console.log('-------------------------------------------\n');

  try {
    // Step 1: Get existing LLM ID to reuse
    console.log('📋 Step 1: Getting existing LLM configuration...\n');
    
    const existingAgentResp = await fetch('https://api.retellai.com/get-agent/agent_fcfcf7f9c84e377b0a1711c0bb', {
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
      },
    });

    const existingAgent = await existingAgentResp.json();
    console.log('Existing Agent LLM ID:', existingAgent.response_engine?.llm_id);
    console.log('Existing Webhook URL:', existingAgent.webhook_url);
    console.log('');

    const llmId = existingAgent.response_engine?.llm_id;
    const webhookUrl = existingAgent.webhook_url;

    if (!llmId) {
      console.error('❌ Could not get LLM ID from existing agent');
      return;
    }

    // Step 2: Create new agent with is_published: true
    console.log('📡 Step 2: Creating NEW published agent...\n');

    const createPayload = {
      agent_name: 'Assistente-Prod',
      voice_id: 'openai-Emily',
      response_engine: {
        type: 'retell-llm',
        llm_id: llmId,
      },
      webhook_url: webhookUrl,
      language: 'pt-BR',
      is_published: true,
    };

    console.log('Create Payload:', JSON.stringify(createPayload, null, 2));
    console.log('');

    const createResp = await fetch('https://api.retellai.com/create-agent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createPayload),
    });

    const createResult = await createResp.json();
    console.log('Create Response Status:', createResp.status);
    console.log('');

    if (!createResp.ok) {
      console.error('❌ Failed to create agent:', JSON.stringify(createResult, null, 2));
      return;
    }

    console.log('✅ New agent created!');
    console.log('Agent ID:', createResult.agent_id);
    console.log('Is Published:', createResult.is_published);
    console.log('');

    const newAgentId = createResult.agent_id;

    // Step 3: Get phone number ID
    console.log('📱 Step 3: Getting phone number ID...\n');
    
    const numbersResp = await fetch('https://api.retellai.com/list-phone-numbers', {
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
      },
    });

    const numbers = await numbersResp.json();
    const targetNumber = numbers.find((n: any) => 
      n.phone_number?.includes('33229800') || n.number?.includes('33229800')
    );

    if (!targetNumber) {
      console.error('❌ Target phone number not found');
      return;
    }

    const phoneNumberId = targetNumber.phone_number_id;
    console.log('Found phone number:', targetNumber.phone_number || targetNumber.number);
    console.log('Phone Number ID:', phoneNumberId);
    console.log('');

    // Step 4: Assign new agent to phone number
    console.log('🔗 Step 4: Assigning new agent to phone number...\n');

    const updatePayload = {
      inbound_agent_id: newAgentId,
      outbound_agent_id: newAgentId,
    };

    const updateResp = await fetch(`https://api.retellai.com/update-phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const updateResult = await updateResp.json();
    console.log('Update Response Status:', updateResp.status);

    if (!updateResp.ok) {
      console.error('❌ Failed to update phone number:', JSON.stringify(updateResult, null, 2));
      return;
    }

    console.log('✅ Phone number updated!');
    console.log('New Inbound Agent:', updateResult.inbound_agent_id);
    console.log('New Outbound Agent:', updateResult.outbound_agent_id);
    console.log('');

    // Verify everything
    console.log('\n🎉 SUCCESS! New published agent assigned!\n');
    console.log('New Agent ID:', newAgentId);
    console.log('Phone Number:', TARGET_NUMBER);
    console.log('');
    console.log('📞 READY FOR TESTING:');
    console.log('   Call: +55 33 2298-0007');
    console.log('   From: +55 64 99952-6870');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

createPublishedAgent().catch(console.error);
