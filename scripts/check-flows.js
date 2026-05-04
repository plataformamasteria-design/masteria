const { Pool } = require('pg');
require('dotenv').config();

async function checkSavedFlows() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('--- Checking automation_flows records ---');

    const res = await client.query('SELECT id, name, company_id, updated_at FROM automation_flows ORDER BY updated_at DESC LIMIT 10');
    console.log('Found ' + res.rows.length + ' flows in database.');
    res.rows.forEach(row => {
      console.log(` - ID: ${row.id}, Name: ${row.name}, Company: ${row.company_id}, UpdatedAt: ${row.updated_at}`);
    });

    if (res.rows.length > 0) {
      console.log('\nSample visual_data for first flow:');
      const detailRes = await client.query('SELECT visual_data FROM automation_flows WHERE id = $1', [res.rows[0].id]);
      console.log(JSON.stringify(detailRes.rows[0].visual_data, null, 2).substring(0, 500) + '...');
    }

    client.release();
  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await pool.end();
  }
}

checkSavedFlows();
