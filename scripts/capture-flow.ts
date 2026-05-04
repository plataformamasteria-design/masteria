import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        const defaultFlow = await db.query.automationFlows.findFirst({
            where: eq(automationFlows.name, 'teste automação')
        });

        if (defaultFlow) {
            console.log('Flow Name:', defaultFlow.name);
            console.log('Visual Data (Nodes):', JSON.stringify(defaultFlow.visualData?.nodes, null, 2));
            console.log('Visual Data (Edges):', JSON.stringify(defaultFlow.visualData?.edges, null, 2));
        } else {
            console.log('Flow not found!');
            const allFlows = await db.select({ name: automationFlows.name }).from(automationFlows);
            console.log('Available flows:', allFlows.map(f => f.name));
        }
    } catch (error) {
        console.error(error);
    }
    process.exit(0);
}
main();
