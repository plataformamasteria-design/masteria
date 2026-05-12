import 'dotenv/config';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { like } from 'drizzle-orm';

async function main() {
    const conns = await db.select().from(connections).where(like(connections.configName, '%Bailey%'));
    console.log(conns.map(c => ({ companyId: c.companyId, name: c.configName, type: c.connectionType, id: c.id })));
    process.exit(0);
}

main();
