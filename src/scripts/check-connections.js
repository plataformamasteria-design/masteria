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
    console.log('--- FETCHING ALL CONNECTIONS ---');
    const res = await client.query('SELECT id, config_name, connection_type, is_active, phone, phone_number_id FROM connections');
    
    res.rows.forEach(conn => {
      console.log(`ID: ${conn.id} | Name: ${conn.config_name} | Type: ${conn.connection_type} | Active: ${conn.is_active} | Phone: ${conn.phone} | PhoneID: ${conn.phone_number_id}`);
    });
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
