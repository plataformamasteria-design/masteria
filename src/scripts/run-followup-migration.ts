// src/scripts/run-followup-migration.ts
// Script para executar a migration de follow-up
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
    console.log('🚀 Executando migration de follow-up...\n');

    try {
        // 1. Adicionar campos de follow-up ao ai_personas
        console.log('1️⃣ Adicionando campos de follow-up ao ai_personas...');
        await db.execute(sql`
      ALTER TABLE ai_personas 
      ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS followup_delay_minutes INTEGER DEFAULT 30 NOT NULL,
      ADD COLUMN IF NOT EXISTS followup_max_attempts INTEGER DEFAULT 3 NOT NULL,
      ADD COLUMN IF NOT EXISTS followup_messages JSONB DEFAULT '["Oi! Vi que você não respondeu... tudo bem por aí? 😊", "Ei, ainda está aí? Posso ajudar em algo mais?", "Última mensagem: se precisar, é só chamar! 🙌"]'::jsonb
    `);
        console.log('   ✅ Campos adicionados com sucesso!\n');

        // 2. Criar tabela de fila de follow-ups
        console.log('2️⃣ Criando tabela ai_followup_queue...');
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_followup_queue (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMP NOT NULL,
        attempt_number INTEGER DEFAULT 1 NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        sent_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
        console.log('   ✅ Tabela criada com sucesso!\n');

        // 3. Criar índices
        console.log('3️⃣ Criando índices...');
        await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_followup_queue_pending 
      ON ai_followup_queue(status, scheduled_at) 
      WHERE status = 'pending'
    `);
        await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_followup_queue_conversation 
      ON ai_followup_queue(conversation_id, status)
    `);
        console.log('   ✅ Índices criados com sucesso!\n');

        // 4. Verificar estrutura
        console.log('4️⃣ Verificando estrutura...');
        const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_personas' 
      AND column_name LIKE 'followup%'
    `);
        console.log('   Colunas de follow-up encontradas:');
        for (const col of columns.rows || []) {
            console.log(`   - ${(col as any).column_name}: ${(col as any).data_type}`);
        }

        const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_followup_queue'
      )
    `);
        const exists = (tableExists.rows?.[0] as any)?.exists ?? false;
        console.log(`   Tabela ai_followup_queue existe: ${exists ? '✅ Sim' : '❌ Não'}`);

        console.log('\n🎉 Migration executada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migration:', error);
        process.exit(1);
    }
}

runMigration();
