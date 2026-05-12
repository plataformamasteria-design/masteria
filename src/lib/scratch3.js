const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"
  });

  await client.connect();

  console.log("All Evolution connections:");
  const res1 = await client.query("SELECT id, config_name, connection_type, session_name, company_id FROM connections WHERE connection_type = 'evolution'");
  console.log(res1.rows);
  
  await client.end();
}

main().catch(console.error);
