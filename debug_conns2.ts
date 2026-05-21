import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { notIlike } from 'drizzle-orm';

async function run() {
    try {
        const res = await db.select().from(connections).where(notIlike(connections.connectionType, 'meta_api'));
        console.log(res.map(c => ({ id: c.id, type: c.connectionType, configName: c.config_name })));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
