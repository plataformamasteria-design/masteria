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
    console.log('--- FETCHING RECENT AUTOMATION LOGS ---');
    const res = await client.query('SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 15');
    
    res.rows.forEach(log => {
      console.log(`[${log.created_at.toISOString()}] [${log.level}] [Co:${log.company_id}] [Conv:${log.conversation_id}] ${log.message}`);
      if (log.details) {
        console.log('Details:', JSON.stringify(log.details, null, 2));
      }
      console.log('---');
    });
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
