
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';

async function main() {
    try {
        const all = await db.select({ id: connections.id, name: connections.config_name }).from(connections);
        console.log(`TOTAL_CONNECTIONS: ${all.length}`);
        all.slice(0, 10).forEach(c => console.log(`ID: ${c.id} | NAME: ${c.name}`));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
main();
