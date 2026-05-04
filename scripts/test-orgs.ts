import "dotenv/config";
import { db } from '../src/lib/db';
import { companies, users, connections, contacts } from '../src/lib/db/schema';
import { eq, count } from 'drizzle-orm';

async function test() {
    try {
        console.log("Testing listAllOrganizations queries...");

        // Extraimos todas as companhias
        const orgs = await db.select().from(companies);
        console.log(`- Found ${orgs.length} orgs`);

        // Group by Users
        const usersStats = await db.select({ companyId: users.companyId, c: count() })
            .from(users).groupBy(users.companyId);
        console.log(`- usersStats success:`, usersStats);

        // Group by Connections
        const connStats = await db.select({ companyId: connections.companyId, c: count() })
            .from(connections).groupBy(connections.companyId);
        console.log(`- connStats success:`, connStats);

        // Group by Contacts
        const contactStats = await db.select({ companyId: contacts.companyId, c: count() })
            .from(contacts).groupBy(contacts.companyId);
        console.log(`- contactStats success:`, contactStats);

        console.log("ALL DB QUERIES SUCCEEDED");
    } catch (e) {
        console.error("ERROR IN QUERIES:", e)
    }
    process.exit(0);
}

test().catch(console.error);
