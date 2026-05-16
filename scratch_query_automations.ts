import { db } from './src/lib/db';
import { automationFlowExecutions, automationFlows, automationLogs } from './src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("Checking automationFlowExecutions...");
    const executions = await db.select({
        status: automationFlowExecutions.status,
        count: sql<number>`count(*)`
    }).from(automationFlowExecutions).groupBy(automationFlowExecutions.status);
    console.log("Executions:", executions);

    console.log("Checking automationFlows...");
    const flows = await db.select({
        isActive: automationFlows.isActive,
        count: sql<number>`count(*)`
    }).from(automationFlows).groupBy(automationFlows.isActive);
    console.log("Flows:", flows);
    
    console.log("Checking automationLogs...");
    const logs = await db.select({
        level: automationLogs.level,
        count: sql<number>`count(*)`
    }).from(automationLogs).groupBy(automationLogs.level);
    console.log("Logs:", logs);
    
    process.exit(0);
}
main().catch(console.error);
