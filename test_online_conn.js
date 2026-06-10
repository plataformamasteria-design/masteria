const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT * FROM connections WHERE company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149' AND is_active = true");
  pool.end();
  
  for (const connection of res.rows) {
    if (connection.connection_type !== 'evolution') continue;
    
    console.log(`Testing connection: ${connection.config_name}`);
    const url = `${process.env.EVOLUTION_API_URL}/instance/connectionState/${connection.session_name || connection.id}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY }
      });
      const data = await response.json();
      console.log(`  State:`, data?.instance?.state);
      
      if (data?.instance?.state === 'open') {
         console.log("  => FOUND ONLINE CONNECTION! Let's test sending...");
         const sendUrl = `${process.env.EVOLUTION_API_URL}/message/sendText/${connection.session_name || connection.id}`;
         const sendRes = await fetch(sendUrl, {
           method: 'POST',
           headers: { 'apikey': process.env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
           body: JSON.stringify({ number: "+5588920008007", text: "Teste" })
         });
         const sendData = await sendRes.json();
         console.log("  => SEND RESULT:", JSON.stringify(sendData));
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
}
main();
