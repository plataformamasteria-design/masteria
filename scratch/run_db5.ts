import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
    });
    console.log("FLOW NAME:", flow?.name);
    process.exit(0);
}
run();
