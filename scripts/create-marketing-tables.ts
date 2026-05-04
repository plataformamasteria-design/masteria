import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
    console.log("Iniciando criação de tabelas da Fase 7 (Marketing)...");
    try {
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS marketing_credentials (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        credentials JSONB,
        connected_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT marketing_credentials_company_platform_unique UNIQUE (company_id, platform)
      );

      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        campaign_name TEXT,
        status TEXT,
        impressions INTEGER NOT NULL DEFAULT 0,
        clicks INTEGER NOT NULL DEFAULT 0,
        spend NUMERIC NOT NULL DEFAULT '0',
        conversions INTEGER NOT NULL DEFAULT 0,
        ctr NUMERIC NOT NULL DEFAULT '0',
        cpc NUMERIC NOT NULL DEFAULT '0',
        cpm NUMERIC NOT NULL DEFAULT '0',
        roas NUMERIC NOT NULL DEFAULT '0',
        date_start TEXT,
        date_end TEXT,
        raw_data JSONB,
        synced_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS marketing_social_profiles (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        profile_name TEXT,
        profile_picture_url TEXT,
        followers_count INTEGER DEFAULT 0,
        follows_count INTEGER DEFAULT 0,
        posts_count INTEGER DEFAULT 0,
        page_likes INTEGER DEFAULT 0,
        page_reach INTEGER DEFAULT 0,
        engagement_rate NUMERIC DEFAULT '0',
        recent_posts JSONB,
        raw_data JSONB,
        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT marketing_profiles_company_platform_profile_unique UNIQUE (company_id, platform, profile_id)
      );
    `);
        console.log("Tabelas de Marketing criadas com sucesso!");
        process.exit(0);
    } catch (error) {
        console.error("Erro na criação das tabelas Marketing:", error);
        process.exit(1);
    }
}

run();
