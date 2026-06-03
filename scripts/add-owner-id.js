const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  try {
    await client.query(`ALTER TABLE "connections" ADD COLUMN "owner_id" text REFERENCES "users"("id") ON DELETE set null;`);
    console.log("Column added successfully!");
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log("Column already exists.");
    } else {
      console.error(e);
    }
  } finally {
    await client.end();
  }
}

run();
