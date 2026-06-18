import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, '5f345023-dcde-4201-8f2c-06d9c7e9ae78')
    });
    console.log('Flow Name:', flow?.name);
    console.log('Flow keys:', Object.keys(flow || {}));
    console.log('Flow:', JSON.stringify(flow, null, 2));
}

run().catch(console.error).then(() => process.exit(0));
