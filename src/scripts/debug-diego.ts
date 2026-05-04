
import { db } from '../lib/db';
import { connections, users, companies } from '../lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log('--- DEBUG DIEGO COMPANY ---');

        // 1. Find Diego
        const [diego] = await db.select().from(users).where(ilike(users.email, '%diego%')).limit(1);
        if (!diego) {
            console.log('User Diego not found by email pattern.');
        } else if (!diego.companyId) {
            console.log(`DIEGO: id=${diego.id}, email=${diego.email}, companyId=NULL`);
        } else {
            console.log(`DIEGO: id=${diego.id}, email=${diego.email}, companyId=${diego.companyId}`);

            const [comp] = await db.select().from(companies).where(eq(companies.id, diego.companyId)).limit(1);
            console.log(`COMPANY: id=${comp?.id}, name=${comp?.name}`);

            // 2. Check connections for this company
            const cons = await db.select().from(connections).where(eq(connections.companyId, diego.companyId));
            console.log(`DIEGO'S CONNECTIONS (${cons.length}):`);
            cons.forEach(c => console.log(` - ID: ${c.id} | NAME: ${c.config_name}`));
        }

        // 3. Check for the orphaned IDs from the logs
        const orphanIds = [
            'aee9a53e-4da5-486e-a9bf-a27e7ead96f2',
            'a45011e5-ba1b-4561-aedc-71ac01dbdf9e',
            '60335cfb-349b-41e9-bd4d-e26d1ed20060'
        ];
        console.log('\n--- ORPHAN CHECK ---');
        for (const id of orphanIds) {
            const [con] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
            if (con) {
                console.log(`FOUND ID ${id}: companyId=${con.companyId}, name=${con.config_name}`);
            } else {
                console.log(`ID ${id} NOT FOUND IN DB.`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
main();
