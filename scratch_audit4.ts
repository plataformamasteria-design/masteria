import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO EMPRESA ---");
        const orgs = await db.select().from(schema.companies).where(ilike(schema.companies.name, '%Rosa Marinelli%'));
        if (orgs.length === 0) return;
        const company = orgs[0];

        console.log("\n--- AGENTES I.A ---");
        // Finding the correct table for agents
        const possibleAgentKeys = Object.keys(schema).filter(k => k.toLowerCase().includes('agent') || k.toLowerCase().includes('bot'));
        console.log("Possible agent tables:", possibleAgentKeys);
        
        // If we find the table, query it
        const agentsTableKey = possibleAgentKeys.find(k => k === 'agents' || k === 'aiAgents' || k === 'bots');
        if (agentsTableKey) {
            const table = (schema as any)[agentsTableKey];
            const aiAgents = await db.select().from(table).where(eq(table.companyId, company.id));
            aiAgents.forEach((a: any) => console.log(`Agente: ${a.name}\nPrompt: ${a.prompt}\n`));
        }

    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
