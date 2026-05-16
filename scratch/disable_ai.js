require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();

    const listId = '67679729-fa38-4ed7-aa48-403c097274df';
    
    console.log('Querying contacts to disable AI...');
    const updateRes = await client.query(`
      UPDATE conversations 
      SET ai_active = false 
      WHERE contact_id IN (
        SELECT contact_id FROM contacts_to_contact_lists WHERE list_id = $1
      )
    `, [listId]);
    
    console.log('Successfully disabled AI for', updateRes.rowCount, 'conversations.');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}
run();
