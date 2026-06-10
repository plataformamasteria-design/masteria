const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT * FROM connections WHERE config_name ILIKE '%Camila%' AND company_id = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'");
  const connection = res.rows[0];
  pool.end();

  if (!connection) {
    console.log("No connection found");
    return;
  }

  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${connection.session_name || connection.id}`;
  console.log("Sending to URL:", url);

  const payload = {
    number: "5588920008007",
    text: "Teste de envio"
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Evolution API Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Evolution API Error:", err.message);
  }
}
main();
