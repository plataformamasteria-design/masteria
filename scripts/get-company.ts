
import { db } from '@/lib/db';
import { companies, users } from '@/lib/db/schema';

async function main() {
    const allCompanies = await db.select().from(companies).limit(1);
    if (allCompanies.length > 0) {
        const c = allCompanies[0];
        console.log(`FOUND_COMPANY_ID: ${c.id}`);

        // Find a user for this company
        const u = await db.select().from(users).where(eq(users.companyId, c.id)).limit(1);
        if (u.length > 0) {
            console.log(`FOUND_USER_ID: ${u[0].id}`);
        } else {
            console.log(`FOUND_USER_ID: mock-user-${c.id}`);
        }
    } else {
        console.log('NO_COMPANIES_FOUND');
    }
    process.exit(0);
}

import { eq } from 'drizzle-orm';
main();
