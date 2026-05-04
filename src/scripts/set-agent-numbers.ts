import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';
const INBOUND_NUMBER = '+553322980007';
const OUTBOUND_NUMBER = '+553322980007';

async function updateAgentNumbers() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  try {
    console.log('\n🔧 RETELL AGENT UPDATE - Adding Phone Numbers\n');
    console.log(`Agent ID: ${AGENT_ID}`);
    console.log(`Inbound Number: ${INBOUND_NUMBER}`);
    console.log(`Outbound Number: ${OUTBOUND_NUMBER}`);
    console.log('-------------------------------------------\n');

    // Try updating with phone numbers
    console.log('📡 Sending PATCH request to Retell API...\n');
    
    const updatePayload = {
      inbound_number: INBOUND_NUMBER,
      outbound_number: OUTBOUND_NUMBER,
    };

    console.log('📋 Payload being sent:');
    console.log(JSON.stringify(updatePayload, null, 2));
    console.log('\n');

    const response = await fetch(`https://api.retellai.com/update-agent/${AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const responseText = await response.text();
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      console.error('❌ Update failed!');
      console.error(`Error: ${responseText}\n`);
      
      // Try to parse error
      try {
        const errorData = JSON.parse(responseText);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
      } catch {
        console.error('Raw error:', responseText);
      }
      
      return;
    }

    const data = JSON.parse(responseText);
    
    console.log('✅ Update successful!\n');
    console.log('📞 Phone Configuration in Response:');
    console.log(`  Inbound: ${data.inbound_number || 'NOT SET'}`);
    console.log(`  Outbound: ${data.outbound_number || 'NOT SET'}`);
    console.log(`  Version: ${data.version}`);
    console.log(`  Published: ${data.is_published}\n`);

    if (data.inbound_number === INBOUND_NUMBER && data.outbound_number === OUTBOUND_NUMBER) {
      console.log('🎉 Numbers saved successfully!\n');
      console.log('✅ Next step: Re-publish the agent in Retell dashboard');
      console.log('   (Click Publish button to apply changes)');
    } else {
      console.log('⚠️  Numbers may not have been saved as expected');
      console.log(`  Expected inbound: ${INBOUND_NUMBER}, got: ${data.inbound_number}`);
      console.log(`  Expected outbound: ${OUTBOUND_NUMBER}, got: ${data.outbound_number}`);
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:\n');
    console.error(error.message);
    process.exit(1);
  }
}

updateAgentNumbers().catch(console.error);
