import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { executeCopilotCommand } from '../src/lib/copilot-engine';

async function run() {
    const companyId = 'ba56e066-6609-437c-9c9f-663e1565410a';
    const qs = [
        "Vê por favor quantos leads estão no Funil do GCR no Kanban na etapa de Lead Novo",
    ];

    for (const q of qs) {
        console.log('\n\n--- TESTE: ' + q + ' ---');
        try {
            const res = await executeCopilotCommand(q, companyId, null);
            console.log(JSON.stringify(res, null, 2));
        } catch(e) {
            console.error(e);
        }
    }
    process.exit(0);
}
run();
