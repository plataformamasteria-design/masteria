import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const dbUrl = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='))?.split('=')[1];
if (dbUrl) process.env.DATABASE_URL = dbUrl.trim().replace(/^"|"$/g, '');

async function run() {
    const { db } = await import('./src/lib/db/index.js');
    const { saveFlow } = await import('./src/lib/automations.js');
    const { automationFlows } = await import('./src/lib/db/schema.js');
    const { ilike } = await import('drizzle-orm');

    try {
        const flows = await db.select().from(automationFlows).where(ilike(automationFlows.name, '%Douglas%')).limit(1);
        if (flows.length === 0) {
            console.log("Douglas Bot not found");
            return;
        }
        const flow = flows[0];
        console.log("Calling saveFlow with data from", flow.name);
        
        const result = await saveFlow('new', 'Test Import 123', flow.companyId, flow.visualData, flow.executionLogic as any);
        console.log("Success:", result);
    } catch (e: any) {
        console.error("saveFlow failed:");
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
