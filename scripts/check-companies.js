const { Pool } = require('pg');
require('dotenv').config();

async function checkCompanies() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('--- Companies Audit ---');

        const res = await client.query('SELECT id, name FROM companies LIMIT 10');
        console.log('Found ' + res.rows.length + ' companies.');
        res.rows.forEach(row => {
            console.log(` - ID: ${row.id}, Name: ${row.name}`);
        });

        client.release();
    } catch (err) {
        console.error('Audit failed:', err.message);
    } finally {
        await pool.end();
    }
}

checkCompanies();
