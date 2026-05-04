require('dotenv').config();
const { Client } = require('pg');

async function push() {
    console.log('Connecting to', process.env.DATABASE_URL);
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log('Connected.');

        await client.query(`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "assigned_to" text;`);
        console.log('Added assigned_to');

        await client.query(`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "team_id" text;`);
        console.log('Added team_id');

        // Also add constraint if possible, but just columns should fix the 500 error
        console.log('Migration successful.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
}
push();
