import { Pool } from 'pg';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=#\s][^=]*)=(.*)/);
    if (match) envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
}

const pool = new Pool({ connectionString: envVars['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

async function main() {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='agent_media_library' ORDER BY ordinal_position`
        );
        console.log('Columns:', JSON.stringify(res.rows, null, 2));
        
        // Test query
        const res2 = await client.query(`SELECT COUNT(*) FROM agent_media_library`);
        console.log('Row count:', res2.rows[0].count);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
