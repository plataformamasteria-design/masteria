import { Client } from "pg";
import { resolve } from "path";
import { config } from "dotenv";

// Load .env directly bypassing NEXT_PUBLIC vars if necessary
config({ path: resolve(__dirname, "../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("ERRO: DATABASE_URL não definida no arquivo .env");
    process.exit(1);
}

const client = new Client({ connectionString });

async function main() {
    try {
        await client.connect();
        console.log("Conectado ao Database! (Fase 12: Automations)");

        // 1. Criar tabela automations
        await client.query(`
      CREATE TABLE IF NOT EXISTS "automations" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
        "name" text NOT NULL,
        "trigger_type" text DEFAULT 'stage_entry',
        "webhook_token" text,
        "schedule_config" jsonb,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
        console.log("Tabela automations validada/criada.");

        // 2. Criar tabela automation_nodes
        await client.query(`
      CREATE TABLE IF NOT EXISTS "automation_nodes" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
        "automation_id" text NOT NULL REFERENCES "automations"("id") ON DELETE cascade,
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
        "node_type" text NOT NULL,
        "position_x" integer NOT NULL,
        "position_y" integer NOT NULL,
        "label" text,
        "config" jsonb DEFAULT '{}'::jsonb
      );
    `);
        console.log("Tabela automation_nodes validada/criada.");

        // 3. Criar tabela automation_edges
        await client.query(`
      CREATE TABLE IF NOT EXISTS "automation_edges" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
        "automation_id" text NOT NULL REFERENCES "automations"("id") ON DELETE cascade,
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
        "source_node_id" text NOT NULL,
        "target_node_id" text NOT NULL,
        "source_handle_id" text,
        "condition_value" text,
        "condition_label" text
      );
    `);
        console.log("Tabela automation_edges validada/criada.");

        console.log("Tabelas de Automação Visual instanciadas com Sucesso. (Fase 12 concluída na base).");
    } catch (error) {
        console.error("ERRO DURANTE INJEÇÃO FASE 12:", error);
    } finally {
        await client.end();
    }
}

main();
