import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';

if (!RETELL_API_KEY) {
  console.error('❌ RETELL_API_KEY not found in environment variables');
  process.exit(1);
}

async function makeRequest(endpoint: string, method = 'GET') {
  const response = await fetch(`https://api.retellai.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function checkAgentConfiguration() {
  try {
    console.log('\n📊 RETELL AGENT CONFIGURATION CHECK\n');
    console.log(`Agent ID: ${AGENT_ID}`);
    console.log(`API Key: ${RETELL_API_KEY!.substring(0, 10)}...`);
    console.log('-------------------------------------------\n');

    // List all agents first
    console.log('📋 Listing all agents...\n');
    const allAgents = await makeRequest('/list-agents');
    console.log(`Found ${allAgents.length} agent(s)\n`);

    // Find our agent
    const agent = allAgents.find((a: any) => a.agent_id === AGENT_ID);

    if (!agent) {
      console.error(`❌ Agent ${AGENT_ID} NOT FOUND!`);
      console.log('\nAvailable agents:');
      allAgents.forEach((a: any) => {
        console.log(`  - ${a.agent_id}: ${a.agent_name}`);
      });
      process.exit(1);
    }

    console.log('✅ Agent Found!\n');
    console.log(`Agent Name: ${agent.agent_name}`);
    console.log(`Agent ID: ${agent.agent_id}`);
    console.log(`Version: ${agent.version || 'N/A'}`);
    console.log(`Published: ${agent.is_published ? '✅ YES' : '❌ NO'}`);
    console.log(`LLM ID: ${agent.response_engine?.llm_id || '❌ NOT SET'}`);

    console.log('\n📞 PHONE CONFIGURATION:');
    console.log(`Inbound Number: ${agent.inbound_number || '❌ NOT SET'}`);
    console.log(`Outbound Number: ${agent.outbound_number || '❌ NOT SET'}`);

    console.log('\n🔔 WEBHOOK CONFIGURATION:');
    console.log(`Webhook URL: ${agent.webhook_url || '❌ NOT SET'}`);

    console.log('\n⚙️ CALL SETTINGS:');
    console.log(`Max Call Duration: ${agent.max_call_duration_ms}ms (${(agent.max_call_duration_ms / 1000 / 60).toFixed(0)} mins)`);
    console.log(`Voice ID: ${agent.voice_id || 'N/A'}`);
    console.log(`Language: ${agent.language || 'N/A'}`);

    console.log('\n📊 FULL AGENT DATA:\n');
    console.log(JSON.stringify(agent, null, 2));

    // Analysis
    console.log('\n\n🔍 CRITICAL ANALYSIS:\n');

    let issues = 0;
    const criticalIssues = [];

    if (!agent.is_published) {
      issues++;
      criticalIssues.push(`⚠️  ISSUE ${issues}: Agent is NOT PUBLISHED!`);
      criticalIssues.push('   → This is likely the root cause of "No Answer" status');
      criticalIssues.push('   → Twilio can reach your endpoint, but agent rejects the call');
    } else {
      console.log('✅ Agent is PUBLISHED');
    }

    if (!agent.inbound_number) {
      issues++;
      criticalIssues.push(`⚠️  ISSUE ${issues}: No inbound_number configured!`);
      criticalIssues.push('   → Agent cannot receive incoming calls');
    } else {
      console.log(`✅ Inbound number: ${agent.inbound_number}`);
    }

    if (!agent.outbound_number) {
      issues++;
      criticalIssues.push(`⚠️  ISSUE ${issues}: No outbound_number configured!`);
      criticalIssues.push('   → Cannot make outbound calls');
    } else {
      console.log(`✅ Outbound number: ${agent.outbound_number}`);
    }

    if (!agent.webhook_url) {
      issues++;
      criticalIssues.push(`⚠️  ISSUE ${issues}: No webhook_url configured!`);
      criticalIssues.push('   → Retell cannot send events to your backend');
    } else {
      console.log(`✅ Webhook URL configured`);
    }

    if (!agent.response_engine?.llm_id) {
      issues++;
      criticalIssues.push(`⚠️  ISSUE ${issues}: No LLM configured!`);
      criticalIssues.push('   → Agent cannot process natural language');
    } else {
      console.log(`✅ LLM configured: ${agent.response_engine.llm_id}`);
    }

    // Print critical issues
    if (criticalIssues.length > 0) {
      criticalIssues.forEach(issue => console.log(issue));
    }

    console.log('\n📊 SUMMARY:');
    if (issues === 0) {
      console.log('✅ All checks passed! Agent is properly configured.');
      console.log('\n🎯 Expected behavior:');
      console.log('  - Incoming SIP calls should connect');
      console.log('  - Agent should answer: "Olá! Bem-vindo ao Master IA..."');
      console.log('  - Webhook events should be logged in your backend');
    } else {
      console.log(`❌ Found ${issues} issues that MUST be fixed before calls work!`);
      console.log('\n🔧 NEXT STEPS:');
      if (!agent.is_published) {
        console.log('  1. Go to Retell Dashboard');
        console.log('  2. Find agent: assistente-2');
        console.log('  3. Click the Publish button');
        console.log('  4. Wait for publication confirmation');
      }
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:\n');
    console.error(`${error.message}`);
    process.exit(1);
  }
}

checkAgentConfiguration().catch(console.error);
