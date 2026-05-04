// src/scripts/run-behavior-migration.ts
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🚀 Iniciando migração de comportamento e variáveis...');

    try {
        const migrationSql = `
      ALTER TABLE "ai_personas" 
      ADD COLUMN IF NOT EXISTS "variables" jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "behavior_presets" jsonb DEFAULT '{
          "useAbbreviations": true,
          "maxEmojisPerMessage": 2,
          "boldSingleCTA": true,
          "variedGreetings": ["Boa", "Show", "Entendi", "Certo", "Bora", "Combinado"],
          "splitResources": true
      }'::jsonb;

      COMMENT ON COLUMN "ai_personas"."variables" IS 'Campos fixos de oferta (Produto, Preço, Checkout, Pix)';
      COMMENT ON COLUMN "ai_personas"."behavior_presets" IS 'Configurações de estilo de resposta e humanização';
    `;

        console.log('📝 Executando SQL...');
        await db.execute(sql.raw(migrationSql));
        console.log('✅ Migração concluída com sucesso!');

        // Verificar se os campos foram criados
        const checkTable = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_personas' 
      AND column_name IN ('variables', 'behavior_presets');
    `);

        console.log('🔍 Verificação de colunas:', checkTable.rows);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
