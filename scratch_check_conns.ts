import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';

async function run() {
  try {
    const conns = await db.select().from(connections);
    console.log(conns.map(c => ({ id: c.id, type: c.connectionType, name: c.config_name })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
