import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db, users } from './src/lib/db';
import { eq } from 'drizzle-orm';

async function test() {
  const user = await db.select().from(users).where(eq(users.role, 'atendente')).limit(1);
  console.log("Current permissions:", user[0].permissions);
  
  await db.update(users).set({ permissions: { tabs: { "Dashboard": true }, viewMode: "all", allowedConnectionIds: [] } }).where(eq(users.id, user[0].id));
  
  const updated = await db.select().from(users).where(eq(users.id, user[0].id));
  console.log("Updated permissions:", updated[0].permissions);
}

test().catch(console.error).finally(() => process.exit(0));
