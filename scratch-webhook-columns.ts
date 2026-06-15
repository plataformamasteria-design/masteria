import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  const result = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'webhook_logs'`);
  console.log('Columns:', result);
  process.exit(0);
}
run();
