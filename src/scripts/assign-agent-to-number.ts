import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';
const TARGET_NUMBER = '+553322980007';

async function assignAgentToNumber() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n🔧 RETELL: ASSIGN AGENT TO PHONE NUMBER\n');
  console.log('Target Number:', TARGET_NUMBER);
  console.log('Agent ID:', AGENT_ID);
  console.log('-------------------------------------------\n');

  try {
    // Step 1: List all phone numbers to find the correct one
    console.log('📱 Step 1: Listing all phone numbers...\n');
    
    const listResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      console.error('❌ Failed to list phone numbers:', error);
      return;
    }

    const numbers = await listResponse.json();
    console.log(`✅ Found ${numbers.length} phone number(s):\n`);

    let targetNumberObj: any = null;

    for (const num of numbers) {
      const phoneNumber = num.phone_number || num.number || 'Unknown';
      const phoneNumberId = num.phone_number_id || num.id || 'N/A';
      const inboundAgentId = num.inbound_agent_id || 'NOT SET';
      const outboundAgentId = num.outbound_agent_id || 'NOT SET';

      console.log(`[${phoneNumber}]`);
      console.log(`  ID: ${phoneNumberId}`);
      console.log(`  Inbound Agent: ${inboundAgentId}`);
      console.log(`  Outbound Agent: ${outboundAgentId}`);
      console.log('');

      // Check if this is our target number
      if (phoneNumber.includes('33229800') || phoneNumber.includes('332298')) {
        targetNumberObj = num;
      }
    }

    if (!targetNumberObj) {
      console.error(`❌ Target number ${TARGET_NUMBER} not found!`);
      console.log('\nAvailable numbers:');
      numbers.forEach((n: any) => console.log(`  - ${n.phone_number || n.number}`));
      return;
    }

    const phoneNumberId = targetNumberObj.phone_number_id || targetNumberObj.id;
    console.log(`\n✅ Found target number!`);
    console.log(`   Number: ${targetNumberObj.phone_number || targetNumberObj.number}`);
    console.log(`   ID: ${phoneNumberId}\n`);

    // Check current agent assignment
    const currentInbound = targetNumberObj.inbound_agent_id;
    const currentOutbound = targetNumberObj.outbound_agent_id;

    if (currentInbound === AGENT_ID && currentOutbound === AGENT_ID) {
      console.log('✅ Agent already assigned to this number!');
      console.log(`   Inbound Agent: ${currentInbound}`);
      console.log(`   Outbound Agent: ${currentOutbound}`);
      console.log('\n🎉 No changes needed. System is ready!');
      return;
    }

    // Step 2: Update the phone number with agent assignment
    console.log('📡 Step 2: Assigning agent to phone number...\n');

    const updatePayload = {
      inbound_agent_id: AGENT_ID,
      outbound_agent_id: AGENT_ID,
    };

    console.log('Payload:', JSON.stringify(updatePayload, null, 2));
    console.log('');

    const updateResponse = await fetch(`https://api.retellai.com/update-phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const updateText = await updateResponse.text();
    console.log(`Response Status: ${updateResponse.status} ${updateResponse.statusText}`);

    if (!updateResponse.ok) {
      console.error('❌ Failed to update phone number!');
      console.error('Error:', updateText);
      return;
    }

    const updatedNumber = JSON.parse(updateText);
    console.log('\n✅ Phone number updated successfully!\n');
    console.log('Updated Configuration:');
    console.log(`  Phone Number: ${updatedNumber.phone_number || updatedNumber.number}`);
    console.log(`  Inbound Agent: ${updatedNumber.inbound_agent_id || 'NOT SET'}`);
    console.log(`  Outbound Agent: ${updatedNumber.outbound_agent_id || 'NOT SET'}`);

    // Verify the assignment
    if (updatedNumber.inbound_agent_id === AGENT_ID) {
      console.log('\n🎉 SUCCESS! Agent assigned to phone number!');
      console.log('\n📞 READY TO TEST:');
      console.log('   Call: +55 33 2298-0007');
      console.log('   From: +55 64 99952-6870');
      console.log('   Expected: Agent will answer the call!');
    } else {
      console.log('\n⚠️  Warning: Agent may not be correctly assigned');
      console.log('Full response:', JSON.stringify(updatedNumber, null, 2));
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

assignAgentToNumber().catch(console.error);
