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
        // Test the exact query that Drizzle generates
        const res = await client.query(
            `SELECT "id", "organization_id", "node_id", "rule_id", "file_name", "file_url", "file_type", "file_size", "description", "storage_path", "created_at" 
             FROM "agent_media_library" 
             WHERE ("agent_media_library"."organization_id" = $1 AND "agent_media_library"."node_id" = $2) 
             ORDER BY "agent_media_library"."created_at"`,
            ['a3591171-a146-4ed1-b49f-d0708cb7cdbd', 'ai_agent_1780567847392']
        );
        console.log('✅ Query bem sucedida! Rows:', res.rows.length);
    } catch (e: any) {
        console.error('❌ Query falhou:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
