import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO EMPRESA ---");
        const orgs = await db.select().from(schema.companies).where(ilike(schema.companies.name, '%Rosa Marinelli%'));
        if (orgs.length === 0) return;
        const company = orgs[0];

        console.log("\n--- AGENTES I.A (PERSONAS) ---");
        const personas = await db.select().from(schema.aiPersonas).where(eq(schema.aiPersonas.companyId, company.id));
        for (const p of personas) {
            console.log(`Persona: ${p.name} (${p.model})`);
            console.log(`System Prompt: ${p.baseSystemPrompt}`);
            const sections = await db.select().from(schema.personaPromptSections).where(eq(schema.personaPromptSections.personaId, p.id));
            sections.forEach((s: any) => console.log(`\nSection [${s.title} - ${s.type}]: ${s.content}`));
        }

        console.log("\n--- AUTOMAÇÕES ---");
        const flows = await db.select().from(schema.automationFlows).where(eq(schema.automationFlows.companyId, company.id));
        flows.forEach((f: any) => console.log(`Automação: ${f.name} (Ativo: ${f.isActive})\nNodes: ${JSON.stringify(f.visualData)}\n`));
        
    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
