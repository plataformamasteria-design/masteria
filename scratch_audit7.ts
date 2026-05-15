import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO AUTOMAÇÃO ---");
        const flows = await db.select().from(schema.automationFlows).where(ilike(schema.automationFlows.name, '%Nova Automa%'));
        
        for (const f of flows) {
            console.log(`Flow: ${f.name} (Company: ${f.companyId})`);
            const nodes = (f.visualData as any)?.nodes || [];
            
            for (const node of nodes) {
                if (node.type === 'aiAgent' || node.type === 'gpt' || node.type === 'prompt' || JSON.stringify(node).toLowerCase().includes('prompt')) {
                    console.log(`\nFound AI/Prompt Node in Flow ${f.name}:`);
                    console.log(JSON.stringify(node, null, 2));
                }
            }
        }
        
    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
