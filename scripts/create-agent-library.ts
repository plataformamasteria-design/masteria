/**
 * Script de criação da tabela agent_media_library e bucket Supabase
 * Executar: tsx scripts/create-agent-library.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    console.log('📦 Criando tabela agent_media_library...');

    const { error: tableError } = await supabase.rpc('exec_sql', {
        sql: `
        CREATE TABLE IF NOT EXISTS agent_media_library (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            rule_id TEXT,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            description TEXT,
            storage_path TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS agent_media_library_org_node_idx 
            ON agent_media_library (organization_id, node_id);
        `
    });

    if (tableError) {
        console.error('❌ Erro ao criar tabela via RPC:', tableError.message);
        console.log('ℹ️  Execute o SQL abaixo manualmente no Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS agent_media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    rule_id TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    description TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_media_library_org_node_idx 
    ON agent_media_library (organization_id, node_id);
        `);
    } else {
        console.log('✅ Tabela criada com sucesso!');
    }

    // Create Storage bucket
    console.log('🪣 Criando bucket agent-library...');
    const { error: bucketError } = await supabase.storage.createBucket('agent-library', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/*', 'application/pdf', 'audio/*', 'video/*', 'text/*']
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
        console.error('❌ Erro ao criar bucket:', bucketError.message);
    } else {
        console.log('✅ Bucket agent-library pronto!');
    }

    console.log('\n🎉 Setup da Biblioteca de Mídia concluído!');
}

run().catch(console.error);
