import { db } from '../src/lib/db';
import { automationNodes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const nodes = await db.query.automationNodes.findMany({
        where: eq(automationNodes.automationId, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
    });
    console.log("DB NODES COUNT:", nodes.length);
    nodes.forEach(n => console.log(n.id));
    process.exit(0);
}
run();
