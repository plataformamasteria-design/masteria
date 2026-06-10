import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const flows = await db.query.automationFlows.findMany({
        where: eq(automationFlows.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149')
    });
    console.log("Flows:", flows.map(f => f.name));
}
main().then(() => process.exit(0)).catch(console.error);
