import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
    console.log("Iniciando criação de tabelas da Fase 10 (Diagnóstico)...");
    try {
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lead_diagnostics (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        reference_month TEXT NOT NULL,
        total_leads INTEGER NOT NULL DEFAULT 0,
        meetings_scheduled INTEGER NOT NULL DEFAULT 0,
        meetings_done INTEGER NOT NULL DEFAULT 0,
        no_show INTEGER NOT NULL DEFAULT 0,
        contracts_won INTEGER NOT NULL DEFAULT 0,
        ltv_total NUMERIC NOT NULL DEFAULT 0,
        ad_spend NUMERIC NOT NULL DEFAULT 0,
        commission_rate NUMERIC NOT NULL DEFAULT 10,
        cpl NUMERIC DEFAULT 0,
        meeting_rate NUMERIC DEFAULT 0,
        cprf NUMERIC DEFAULT 0,
        conversion_rate NUMERIC DEFAULT 0,
        cac_marketing NUMERIC DEFAULT 0,
        cac_approximate NUMERIC DEFAULT 0,
        ticket_medio NUMERIC DEFAULT 0,
        mrr NUMERIC DEFAULT 0,
        roas NUMERIC DEFAULT 0,
        commission_total NUMERIC DEFAULT 0,
        closers_result NUMERIC DEFAULT 0,
        campaign_name TEXT,
        campaign_platform TEXT,
        campaign_impressions INTEGER DEFAULT 0,
        campaign_clicks INTEGER DEFAULT 0,
        campaign_ctr NUMERIC DEFAULT 0,
        campaign_cpc NUMERIC DEFAULT 0,
        campaign_conversions INTEGER DEFAULT 0,
        campaign_cost_per_conversion NUMERIC DEFAULT 0,
        campaign_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, reference_month)
      );

      CREATE TABLE IF NOT EXISTS agent_commissions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        commission_type TEXT NOT NULL DEFAULT 'percentage',
        fixed_value NUMERIC NOT NULL DEFAULT 0,
        percentage_value NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(company_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS funnels (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        visualization_type TEXT NOT NULL DEFAULT 'funnel',
        tag_order JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS funnel_stages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        funnel_id TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_funnel_stage (
        chat_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        funnel_id TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
        stage_id TEXT NOT NULL REFERENCES funnel_stages(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (chat_id, funnel_id)
      );
    `);
        console.log("Tabelas criadas com sucesso!");
        process.exit(0);
    } catch (error) {
        console.error("Erro na criação:", error);
        process.exit(1);
    }
}

run();
