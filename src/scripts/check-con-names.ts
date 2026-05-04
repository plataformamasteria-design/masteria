
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
    try {
        const names = [
            '%Antonio%',
            '%8272%',
            '%1033%',
            '%5865%'
        ];

        console.log('--- SEARCHING BY NAME ---');
        for (const name of names) {
            const results = await db.select().from(connections).where(ilike(connections.config_name, name));
            console.log(`Searching for "${name}": Found ${results.length}`);
            results.forEach(r => console.log(` - FOUND: ID=${r.id}, NAME=${r.config_name}, companyId=${r.companyId}`));
        }

        console.log('\n--- ALL CONNECTIONS IN DB ---');
        const all = await db.select().from(connections);
        all.forEach(r => console.log(` - ID=${r.id}, NAME=${r.config_name}, companyId=${r.companyId}`));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
main();
