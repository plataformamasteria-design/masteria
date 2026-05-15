require('dotenv').config({ path: '.env.local' });
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const db = drizzle(pool);
  console.log("Adding constraints...");
  try {
    await db.execute(sql`ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_company_campaign_unique UNIQUE (company_id, campaign_id);`);
    console.log("campaigns ok");
  } catch (e) { console.log(e.message); }
  
  try {
    await db.execute(sql`ALTER TABLE marketing_adsets ADD CONSTRAINT marketing_adsets_company_adset_unique UNIQUE (company_id, adset_id);`);
    console.log("adsets ok");
  } catch (e) { console.log(e.message); }
  
  try {
    await db.execute(sql`ALTER TABLE marketing_ads ADD CONSTRAINT marketing_ads_company_ad_unique UNIQUE (company_id, ad_id);`);
    console.log("ads ok");
  } catch (e) { console.log(e.message); }
  
  pool.end();
}

main();
