import { db } from './src/lib/db';
import { marketingCredentials } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, 'meta'));
  console.log("Meta Credentials in DB:", JSON.stringify(creds, null, 2));
  process.exit(0);
}
run();
