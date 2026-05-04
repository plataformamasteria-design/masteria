const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('--- UPDATING BAILEYS CONNECTION TO ACTIVE ---');
    const res = await client.query("UPDATE connections SET is_active = true WHERE connection_type = 'baileys' AND config_name = 'wtz-6-iphone_-'");
    console.log(`Updated ${res.rowCount} rows.`);
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
