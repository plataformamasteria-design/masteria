import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  const result = await db.execute(sql`SELECT payload FROM webhook_logs WHERE payload::text LIKE '%messages.upsert%' ORDER BY created_at DESC LIMIT 1`);
  console.log('Log:', JSON.stringify(result, null, 2));
  process.exit(0);
}
run();
