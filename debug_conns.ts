import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const allConns = await db.select().from(connections);
  console.log(allConns.map(c => ({ id: c.id, name: c.name, type: c.connectionType })));
  process.exit(0);
}
check().catch(console.error);
