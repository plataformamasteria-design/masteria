import 'dotenv/config';
import postgres from 'postgres';

async function migrate() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('No DATABASE_URL');
  
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log("Creating enum invoice_status...");
    await sql`
      DO $$ BEGIN
        CREATE TYPE invoice_status AS ENUM ('PENDING', 'PAID', 'OVERDUE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    console.log("Creating table company_monthly_invoices...");
    await sql`
      CREATE TABLE IF NOT EXISTS "company_monthly_invoices" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action,
        "month_year" text NOT NULL,
        "monthly_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
        "fixed_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
        "variable_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
        "ai_tokens_used" integer DEFAULT 0 NOT NULL,
        "total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
        "net_profit" numeric(10, 2) DEFAULT '0' NOT NULL,
        "payment_due_date" date NOT NULL,
        "paid_at" timestamp,
        "status" "invoice_status" DEFAULT 'PENDING' NOT NULL,
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "monthly_invoices_company_month_unique" UNIQUE("company_id","month_year")
      );
    `;

    console.log("Creating indexes...");
    await sql`CREATE INDEX IF NOT EXISTS "monthly_invoices_company_idx" ON "company_monthly_invoices" USING btree ("company_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "monthly_invoices_month_year_idx" ON "company_monthly_invoices" USING btree ("month_year");`;
    
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}

migrate();
