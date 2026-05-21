import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
async function check() {
  const all = await db.select({ id: connections.id, name: connections.config_name, type: connections.connectionType }).from(connections);
  console.log(all);
  process.exit(0);
}
check().catch(console.error);
