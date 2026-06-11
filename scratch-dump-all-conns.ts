import 'dotenv/config';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';

async function main() {
    const conns = await db.select().from(connections);
    console.log(conns.map(c => `${c.config_name} (Type: ${c.connectionType})`));
}

main().catch(console.error);
