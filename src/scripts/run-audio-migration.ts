// src/scripts/run-audio-migration.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Iniciando migração para Áudio Humanizado Nativo...');

    try {
        const migrationSql = `
          ALTER TABLE "ai_personas" 
          ADD COLUMN IF NOT EXISTS "audio_mode" VARCHAR(20) DEFAULT 'text',
          ADD COLUMN IF NOT EXISTS "voice_settings" JSONB DEFAULT '{
              "voiceId": "Aoede",
              "speed": 1.0,
              "stability": 0.5
          }'::jsonb;

          COMMENT ON COLUMN "ai_personas"."audio_mode" IS 'Modos de resposta: text, audio, both';
          COMMENT ON COLUMN "ai_personas"."voice_settings" IS 'Configurações de voz e estilo de áudio';
        `;

        console.log('📝 Executando SQL...');
        await db.execute(sql.raw(migrationSql));
        console.log('✅ Migração de áudio concluída com sucesso!');

        // Verificar se os campos foram criados
        const checkTable = await db.execute(sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'ai_personas' 
          AND column_name IN ('audio_mode', 'voice_settings');
        `);

        console.log('🔍 Verificação de colunas:', checkTable.rows);

    } catch (error) {
        console.error('❌ Erro na migração de áudio:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
