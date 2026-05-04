import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("=== Migração: Criando tabelas marketing_adsets e marketing_ads ===");

    // 1. Adicionar colunas novas em marketing_campaigns
    try {
        await db.execute(sql`
            ALTER TABLE marketing_campaigns 
            ADD COLUMN IF NOT EXISTS objective TEXT,
            ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS frequency NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cost_per_lead NUMERIC
        `);
        console.log("✅ Colunas objective, reach, frequency, cost_per_lead adicionadas em marketing_campaigns");
    } catch (e: any) {
        console.log("⚠️ Colunas já existem ou erro:", e.message);
    }

    // 2. Criar tabela marketing_adsets
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS marketing_adsets (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                platform TEXT NOT NULL,
                campaign_id TEXT NOT NULL,
                adset_id TEXT NOT NULL,
                adset_name TEXT,
                status TEXT,
                daily_budget NUMERIC,
                lifetime_budget NUMERIC,
                optimization_goal TEXT,
                impressions INTEGER NOT NULL DEFAULT 0,
                clicks INTEGER NOT NULL DEFAULT 0,
                spend NUMERIC NOT NULL DEFAULT 0,
                conversions INTEGER NOT NULL DEFAULT 0,
                ctr NUMERIC NOT NULL DEFAULT 0,
                cpc NUMERIC NOT NULL DEFAULT 0,
                cpm NUMERIC NOT NULL DEFAULT 0,
                reach INTEGER DEFAULT 0,
                frequency NUMERIC DEFAULT 0,
                cost_per_lead NUMERIC,
                raw_data JSONB,
                synced_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        `);
        console.log("✅ Tabela marketing_adsets criada");
    } catch (e: any) {
        console.log("⚠️ marketing_adsets:", e.message);
    }

    // 3. Criar tabela marketing_ads
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS marketing_ads (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                platform TEXT NOT NULL,
                adset_id TEXT NOT NULL,
                campaign_id TEXT NOT NULL,
                ad_id TEXT NOT NULL,
                ad_name TEXT,
                status TEXT,
                impressions INTEGER NOT NULL DEFAULT 0,
                clicks INTEGER NOT NULL DEFAULT 0,
                spend NUMERIC NOT NULL DEFAULT 0,
                conversions INTEGER NOT NULL DEFAULT 0,
                ctr NUMERIC NOT NULL DEFAULT 0,
                cpc NUMERIC NOT NULL DEFAULT 0,
                cpm NUMERIC NOT NULL DEFAULT 0,
                reach INTEGER DEFAULT 0,
                frequency NUMERIC DEFAULT 0,
                cost_per_lead NUMERIC,
                creative_thumbnail_url TEXT,
                creative_body TEXT,
                creative_title TEXT,
                raw_data JSONB,
                synced_at TIMESTAMP DEFAULT NOW() NOT NULL
            )
        `);
        console.log("✅ Tabela marketing_ads criada");
    } catch (e: any) {
        console.log("⚠️ marketing_ads:", e.message);
    }

    console.log("=== Migração finalizada com sucesso! ===");
    process.exit(0);
}

main().catch(console.error);
