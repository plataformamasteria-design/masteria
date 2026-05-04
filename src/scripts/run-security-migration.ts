// src/scripts/run-security-migration.ts
// Script para executar a migration de logs de segurança
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
    console.log('🔒 Executando migration de segurança...\n');

    try {
        // 1. Criar tabela de logs de segurança
        console.log('1️⃣ Criando tabela security_logs...');
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        threat_type TEXT NOT NULL,
        threat_level TEXT NOT NULL,
        content TEXT,
        action_taken TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
        console.log('   ✅ Tabela criada com sucesso!\n');

        // 2. Criar índices
        console.log('2️⃣ Criando índices...');
        await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_security_logs_company 
      ON security_logs(company_id, created_at DESC)
    `);
        await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_security_logs_type 
      ON security_logs(threat_type, threat_level)
    `);
        console.log('   ✅ Índices criados com sucesso!\n');

        // 3. Verificar estrutura
        console.log('3️⃣ Verificando estrutura...');
        const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'security_logs'
      )
    `);
        const exists = (tableExists.rows?.[0] as any)?.exists ?? false;
        console.log(`   Tabela security_logs existe: ${exists ? '✅ Sim' : '❌ Não'}`);

        console.log('\n🎉 Migration de segurança executada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migration:', error);
        process.exit(1);
    }
}

runMigration();
