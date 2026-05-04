import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const _AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';

async function listAvailableNumbers() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  try {
    console.log('\n📱 LISTING AVAILABLE PHONE NUMBERS IN RETELL\n');
    console.log('-------------------------------------------\n');

    // Get list of phone numbers
    const response = await fetch('https://api.retellai.com/list-phone-numbers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error (${response.status}):`, errorText);
      return;
    }

    const numbers = await response.json();
    
    if (!Array.isArray(numbers) || numbers.length === 0) {
      console.log('❌ No phone numbers found\n');
      return;
    }

    console.log(`✅ Found ${numbers.length} phone number(s):\n`);
    
    numbers.forEach((num: any, idx: number) => {
      console.log(`[${idx + 1}] ${num.phone_number || num.number || 'Unknown'}`);
      console.log(`    ID: ${num.phone_number_id || num.id || 'N/A'}`);
      console.log(`    Status: ${num.status || 'N/A'}`);
      console.log(`    Provider: ${num.provider || 'N/A'}`);
      if (num.capabilities) {
        console.log(`    Capabilities: ${JSON.stringify(num.capabilities)}`);
      }
      console.log();
    });

    // Check if our target number exists
    const targetNumber = '+553322980007';
    const found = numbers.find((n: any) => 
      (n.phone_number || n.number) === targetNumber || 
      (n.phone_number || n.number)?.includes('298-0007')
    );

    if (found) {
      console.log(`✅ Target number ${targetNumber} is available!`);
      console.log(`   ID: ${found.phone_number_id || found.id}`);
      console.log(`   You can use this number when publishing the agent`);
    } else {
      console.log(`⚠️  Target number ${targetNumber} not found in your list`);
      console.log(`   Use one of the numbers above when publishing the agent`);
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:\n', error.message);
    process.exit(1);
  }
}

listAvailableNumbers().catch(console.error);
