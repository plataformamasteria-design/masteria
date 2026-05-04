import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  const connections = await db.execute(sql`SELECT id, config_name, connection_type, phone_number, phone FROM connections`);
  fs.writeFileSync('connections_list.json', JSON.stringify(connections.rows || connections, null, 2));
  console.log("Exported connections_list.json");
  process.exit(0);
}
run();
