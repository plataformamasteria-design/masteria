const { Pool } = require('pg');
require('dotenv').config();

async function createTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('--- Creating automation_flows table ---');

        const sql = `
      CREATE TABLE IF NOT EXISTS "automation_flows" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_id" text NOT NULL,
        "name" text NOT NULL,
        "is_active" boolean DEFAULT false NOT NULL,
        "visual_data" jsonb NOT NULL,
        "execution_logic" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_flows_company_id_companies_id_fk') THEN
          ALTER TABLE "automation_flows" 
          ADD CONSTRAINT "automation_flows_company_id_companies_id_fk" 
          FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") 
          ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `;

        await client.query(sql);
        console.log('SUCCESS: Table automation_flows created successfully.');

        client.release();
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

createTable();
