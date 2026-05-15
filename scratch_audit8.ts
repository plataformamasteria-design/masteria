import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';
import * as fs from 'fs';

async function main() {
    try {
        const flows = await db.select().from(schema.automationFlows).where(ilike(schema.automationFlows.name, '%Nova Automa%'));
        let out = "";
        for (const f of flows) {
            out += `Flow: ${f.name} (Company: ${f.companyId})\n`;
            const nodes = (f.visualData as any)?.nodes || [];
            
            for (const node of nodes) {
                if (node.type === 'aiAgent' || node.type === 'gpt' || node.type === 'prompt' || JSON.stringify(node).toLowerCase().includes('prompt')) {
                    out += `\nFound AI/Prompt Node in Flow ${f.name}:\n`;
                    out += node.data?.prompt || node.data?.systemPrompt || JSON.stringify(node, null, 2);
                    out += "\n----------------------------------------\n";
                }
            }
        }
        fs.writeFileSync('prompt_extracted.txt', out);
        console.log("Extracted to prompt_extracted.txt");
    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
