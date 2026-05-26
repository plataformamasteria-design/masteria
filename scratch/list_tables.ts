require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { sql } = await import('drizzle-orm');

  const tables = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log(JSON.stringify(tables));
  process.exit(0);
}
main().catch(console.error);
