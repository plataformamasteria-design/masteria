const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query("SELECT company_id, id FROM connections WHERE config_name ILIKE '%Camila%'");
  console.log("Camila company:", res.rows[0]);
  pool.end();
  process.exit(0);
}
main();
