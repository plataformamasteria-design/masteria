import { db } from '../lib/db';
import { crmIntegrations, crmAccounts, users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    console.log('Fetching active Kommo integrations...');
    const integrations = await db.select().from(crmIntegrations).where(eq(crmIntegrations.provider, 'kommo'));

    for (const intg of integrations) {
        if (intg.status === 'connected') {
            console.log(`Company ID: ${intg.companyId}`);
            console.log(`Mapping: ${JSON.stringify(intg.fieldMapping, null, 2)}`);

            const [user] = await db.select().from(users).where(eq(users.companyId, intg.companyId)).limit(1);
            console.log(`User Email: ${user?.email}`);
        }
    }
    process.exit(0);
}

run().catch(console.error);
