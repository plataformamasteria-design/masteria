
import { db } from '../lib/db';
import { companies } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const slugToCheck = process.argv[2];

async function main() {
    if (!slugToCheck) {
        console.log('Please provide a slug to check.');
        return;
    }
    console.log(`Checking slug: ${slugToCheck}`);

    // Check companies
    const [comp] = await db.select().from(companies).where(eq(companies.webhookSlug, slugToCheck));
    if (comp) {
        console.log(`FOUND in Companies! Company ID: ${comp.id}, Name: ${comp.name}`);
    } else {
        console.log('NOT FOUND in Companies table.');
    }
}

main().catch(console.error).finally(() => process.exit(0));
