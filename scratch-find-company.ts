import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
import { companies, campaigns } from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
    const company = await db.query.companies.findFirst({
        where: ilike(companies.name, '%Empresa de DEsenvolvimento Master%')
    });
    console.log("Company:", company ? { id: company.id, name: company.name } : "Not found");
    
    if (company) {
        const camps = await db.select().from(campaigns).where(eq(campaigns.companyId, company.id));
        console.log("Campaigns:", camps.map(c => ({ id: c.id, name: c.name, status: c.status })));
    }
}
main().then(() => process.exit(0)).catch(console.error);
