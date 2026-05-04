
const { Client } = require('pg');

async function checkPersonas() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    try {
        const res = await client.query('SELECT id, name, provider, model, is_active FROM ai_personas');
        console.log('AI Personas:');
        console.table(res.rows);
    } finally {
        await client.end();
    }
}

checkPersonas().catch(console.error);
