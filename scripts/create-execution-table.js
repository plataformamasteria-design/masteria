const { Pool } = require('pg');
require('dotenv').config();

async function createExecutionsTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('--- Creating automation_flow_executions table ---');

        const sql = `
      CREATE TABLE IF NOT EXISTS "automation_flow_executions" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_id" text NOT NULL,
        "flow_id" text NOT NULL,
        "contact_id" text,
        "status" text NOT NULL,
        "current_step_id" text,
        "variables" jsonb DEFAULT '{}',
        "error" text,
        "started_at" timestamp DEFAULT now() NOT NULL,
        "finished_at" timestamp
      );

      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_flow_exec_company_fk') THEN
          ALTER TABLE "automation_flow_executions" 
          ADD CONSTRAINT "automation_flow_exec_company_fk" 
          FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") 
          ON DELETE cascade ON UPDATE no action;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_flow_exec_flow_fk') THEN
          ALTER TABLE "automation_flow_executions" 
          ADD CONSTRAINT "automation_flow_exec_flow_fk" 
          FOREIGN KEY ("flow_id") REFERENCES "public"."automation_flows"("id") 
          ON DELETE cascade ON UPDATE no action;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_flow_exec_contact_fk') THEN
          ALTER TABLE "automation_flow_executions" 
          ADD CONSTRAINT "automation_flow_exec_contact_fk" 
          FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") 
          ON DELETE set null ON UPDATE no action;
        END IF;
      END $$;
    `;

        await client.query(sql);
        console.log('SUCCESS: Table automation_flow_executions created successfully.');

        client.release();
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

createExecutionsTable();
