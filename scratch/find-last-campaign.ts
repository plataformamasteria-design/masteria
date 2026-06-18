import { db } from '../src/lib/db';
import { campaigns } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';
async function run() {
    const last = await db.query.campaigns.findFirst({
        orderBy: [desc(campaigns.createdAt)]
    });
    console.log(last);
    process.exit(0);
}
run();
