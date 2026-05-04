
import path from 'path';
import dotenv from 'dotenv';

// 1. Force Load Env Params BEFORE anything else
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

async function main() {
    console.log('--- DB DIAGNOSTIC START ---');
    try {
        // 2. Dynamic Import to prevent hoisting
        const { db } = await import('../lib/db');
        const { connections } = await import('../lib/db/schema');

        // 3. Query - REPLICATING THE EXACT FILTER FROM HEALTH API
        // Filter: (companyId = X) AND (type IN ['meta_api', 'instagram', 'instagram_direct'] OR type IS NULL)

        // We query EVERYTHING first to see raw truth
        const allConnections = await db.select().from(connections);
        console.log(`\nRAW TOTAL in DB: ${allConnections.length}`);

        if (allConnections.length > 0) {
            console.table(allConnections.map(c => ({
                id: c.id,
                name: c.config_name,
                type: c.connectionType || 'NULL', // Mark explicit null
                active: c.isActive,
                company: c.companyId
            })));

            // Now apply the Filter logic to see what the API *Should* see
            const validTypes = ['meta_api', 'instagram', 'instagram_direct'];
            const visibleConnections = allConnections.filter(c =>
                (c.connectionType && validTypes.includes(c.connectionType)) || c.connectionType === null
            );

            console.log(`\nVISIBLE to API (Filtered): ${visibleConnections.length}`);
            if (visibleConnections.length !== allConnections.length) {
                console.log('⚠️ GHOSTS IDENTIFIED: Some connections exist but are hidden by filters.');
            }

        } else {
            console.log('✅ Database is completely empty. Ghost count MUST be 0.');
        }

    } catch (err) {
        console.error('Error querying DB:', err);
    }
    console.log('--- DB DIAGNOSTIC END ---');
    process.exit(0);
}

main();
