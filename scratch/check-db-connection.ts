import { db } from '../src/lib/db/index';
import { companies, connections } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
    try {
        const company = await db.query.companies.findFirst({
            where: ilike(companies.name, '%Deivid Rodrigues%')
        });

        if (!company) {
            console.log("Company not found.");
            process.exit(1);
        }

        const conns = await db.query.connections.findMany({
            where: eq(connections.companyId, company.id)
        });

        console.log(`Found ${conns.length} connections for company ${company.name}`);
        for (const c of conns) {
            console.log(JSON.stringify(c, null, 2));
            console.log("-----------------------");
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
