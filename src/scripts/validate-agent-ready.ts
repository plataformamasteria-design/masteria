import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';

async function validateAgent() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  try {
    console.log('\n✅ VALIDATING AGENT CONFIGURATION\n');
    console.log('-------------------------------------------\n');

    // Get agent
    const allAgents = await fetch('https://api.retellai.com/list-agents', {
      headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
    }).then(r => r.json());

    const agent = allAgents.find((a: any) => a.agent_id === AGENT_ID);

    if (!agent) {
      console.error('❌ Agent not found');
      process.exit(1);
    }

    const checks = {
      'Agent Published': agent.is_published,
      'Inbound Number Set': !!agent.inbound_number,
      'Outbound Number Set': !!agent.outbound_number,
      'LLM Configured': !!agent.response_engine?.llm_id,
      'Webhook Configured': !!agent.webhook_url,
    };

    console.log(`Version: ${agent.version}`);
    console.log(`Version Title: ${agent.version_title || 'N/A'}`);
    console.log(`Published: ${agent.is_published ? '✅ YES' : '❌ NO'}\n`);

    console.log('Phone Numbers:');
    console.log(`  Inbound:  ${agent.inbound_number || '❌ NOT SET'}`);
    console.log(`  Outbound: ${agent.outbound_number || '❌ NOT SET'}\n`);

    let allGood = true;
    Object.entries(checks).forEach(([name, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`${status} ${name}`);
      if (!value) allGood = false;
    });

    console.log('\n-------------------------------------------\n');

    if (allGood) {
      console.log('🎉 Agent is READY for incoming calls!\n');
      console.log('Next: Make a test call to +55 33 2298-0007');
      console.log('Expected: Agent will answer and speak');
    } else {
      console.log('❌ Agent is NOT ready. Missing configuration:');
      Object.entries(checks).forEach(([name, value]) => {
        if (!value) console.log(`   • ${name}`);
      });
      console.log('\nReturn to Retell Dashboard and complete setup.');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

validateAgent().catch(console.error);
