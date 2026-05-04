const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- Database Audit ---');
        const client = await pool.connect();

        // 1. List all tables in public schema
        const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        console.log('Found ' + tableRes.rows.length + ' tables in public schema.');
        tableRes.rows.forEach(row => {
            console.log(` - ${row.table_name}`);
        });

        // 2. Specifically check for automation_flows
        const specificTable = tableRes.rows.find(row => row.table_name === 'automation_flows');
        if (!specificTable) {
            console.log('\nCONFIRMED: automation_flows is MISSING.');
        } else {
            console.log('\nSUCCESS: automation_flows EXISTS.');
        }

        client.release();
    } catch (err) {
        console.error('Database connection failed:', err.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
