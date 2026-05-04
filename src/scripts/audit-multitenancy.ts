
import { db } from '../lib/db';
import { connections, companies, users } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';

async function main() {
    console.log('--- TARGETED AUDIT START ---');

    try {
        const failingIds = [
            'aee9a53e-4da5-486e-a9bf-a27e7ead96f2',
            'a45011e5-ba1b-4561-aedc-71ac01dbdf9e',
            '60335cfb-349b-41e9-bd4d-e26d1ed20060'
        ];

        console.log('Querying provided connection IDs...');
        const targetCons = await db.select({
            id: connections.id,
            companyId: connections.companyId,
            config_name: connections.config_name
        }).from(connections).where(inArray(connections.id, failingIds));

        console.log('TARGET CONNECTIONS:', JSON.stringify(targetCons, null, 2));

        const companyIds = targetCons.map(c => c.companyId);
        if (companyIds.length > 0) {
            console.log('Querying companies involved...');
            const targetCompanies = await db.select().from(companies).where(inArray(companies.id, companyIds));
            console.log('INVOLVED COMPANIES:', JSON.stringify(targetCompanies, null, 2));

            console.log('Querying users associated with these companies...');
            const targetUsers = await db.select({
                id: users.id,
                email: users.email,
                companyId: users.companyId
            }).from(users).where(inArray(users.companyId, companyIds));
            console.log('ASSOCIATED USERS:', JSON.stringify(targetUsers, null, 2));
        } else {
            console.log('NONE of the IDs found in database.');
        }

        console.log('--- AUDIT END ---');
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        process.exit(0);
    }
}

main();
