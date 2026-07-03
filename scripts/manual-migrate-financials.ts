import 'dotenv/config';
import postgres from 'postgres';

async function migrate() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('No DATABASE_URL');
  
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log("Creating table company_financials...");
    await sql`
      CREATE TABLE IF NOT EXISTS "company_financials" (
        "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action,
        "monthly_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
        "implementation_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
        "fixed_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
        "variable_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
        "payment_day" integer DEFAULT 10 NOT NULL,
        "last_payment_date" timestamp,
        "total_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}

migrate();
