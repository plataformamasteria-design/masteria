import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './src/lib/db';
import { contacts } from './src/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

async function main() {
    console.log('Testing db...');
    const items = await db.select().from(contacts).where(isNotNull(contacts.tags)).limit(5);
    for (const c of items) {
        console.log(c.name, c.tags);
    }
    process.exit(0);
}

main().catch(console.error);
