const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT id, config_name, session_name FROM connections WHERE config_name ILIKE '%Camila%'");
  console.log("Found connections:", res.rows);
  
  if (res.rows.length > 0) {
    for (const c of res.rows) {
      const instanceName = c.session_name || c.id;
      console.log(`Checking status for ${instanceName}...`);
      try {
        const fetch = require('node-fetch');
        const url = process.env.EVOLUTION_API_URL + '/instance/connectionState/' + instanceName;
        const stateRes = await fetch(url, { headers: { apikey: process.env.EVOLUTION_API_KEY } });
        const state = await stateRes.json();
        console.log(`State for ${instanceName}:`, state);
      } catch (e) {
        console.log(`Error checking state for ${instanceName}:`, e.message);
      }
    }
  }
  pool.end();
  process.exit(0);
}
main();
