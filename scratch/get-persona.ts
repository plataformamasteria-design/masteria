import { db } from '../src/lib/db/index';
import { companies, aiPersonas, personaPromptSections } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';
import fs from 'fs';

async function main() {
    try {
        const company = await db.query.companies.findFirst({
            where: ilike(companies.name, '%Henrique Felipe Alves%')
        });

        if (!company) {
            console.log("Company not found.");
            process.exit(1);
        }

        const personas = await db.query.aiPersonas.findMany({
            where: eq(aiPersonas.companyId, company.id)
        });

        const promptSections = await db.query.personaPromptSections.findMany({
            where: eq(personaPromptSections.personaId, personas[0]?.id) // Assuming first persona is the main one
        });

        const output = {
            personas: personas.map(p => ({
                id: p.id,
                name: p.name,
                systemPrompt: p.systemPrompt,
                behaviorPresets: p.behaviorPresets,
                variables: p.variables,
                resources: p.resources
            })),
            sections: promptSections
        };

        fs.writeFileSync('./scratch/persona-audit.json', JSON.stringify(output, null, 2));
        console.log("Saved to scratch/persona-audit.json");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
