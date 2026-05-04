import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require',
});

async function runHotfix() {
    const client = await pool.connect();
    console.log('Connected to DB');

    try {
        // Drop the AI follow-up queue constraints if any or just try ALTER TABLE IF NOT EXISTS
        console.log('Adding resolved_at to conversations...');
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS resolved_at timestamp;`);

        console.log('Adding resolved_by to conversations...');
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS resolved_by text;`);

        console.log('Adding assigned_at to chat_funnel_stage...');
        await client.query(`ALTER TABLE chat_funnel_stage ADD COLUMN IF NOT EXISTS assigned_at timestamp DEFAULT clock_timestamp() NOT NULL;`);

        console.log('All migrations executed successfully!');
    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        client.release();
        pool.end();
    }
}

runHotfix();
