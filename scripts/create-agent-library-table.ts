// Script para criar a tabela agent_media_library diretamente no Neon
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load env from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=#\s][^=]*)=(.*)/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    }
}

const DATABASE_URL = envVars['DATABASE_URL'] || process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL não encontrada');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS agent_media_library (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                organization_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                rule_id TEXT,
                file_name TEXT NOT NULL,
                file_url TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                description TEXT,
                storage_path TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
            );
        `);
        console.log('✅ Tabela agent_media_library criada/verificada com sucesso!');
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_agent_media_library_org_node 
            ON agent_media_library (organization_id, node_id);
        `);
        console.log('✅ Índice criado com sucesso!');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
