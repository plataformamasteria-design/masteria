import { db } from './src/lib/db';
import { automationRules, companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
    try {
        const company = await db.query.companies.findFirst();
        if (!company) throw new Error("No company found");

        // Clean up previous test rules
        await db.delete(automationRules).where(eq(automationRules.name, 'Teste Simulador Aprendizado'));

        const ruleId = uuidv4();
        
        const aiNode = {
            id: 'ai-agent-1',
            type: 'ai_agent',
            position: { x: 100, y: 100 },
            data: {
                label: 'Agente de Vendas',
                config: {
                    system_message: 'Você é um vendedor de sapatos. Seja educado.',
                    model: 'gpt-4o-mini',
                    dialogue_mode: true
                }
            }
        };

        await db.insert(automationRules).values({
            id: ruleId,
            companyId: company.id,
            name: 'Teste Simulador Aprendizado',
            triggerEvent: 'message_received',
            conditions: [],
            conditionLogic: 'AND',
            actions: [
                {
                    type: 'send_message',
                    value: JSON.stringify({
                        nodes: [
                            { id: 'start-1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Início' } },
                            aiNode
                        ],
                        edges: [
                            { id: 'e-1', source: 'start-1', target: 'ai-agent-1' }
                        ]
                    })
                }
            ]
        });

        console.log(\`✅ Automação de teste criada com ID: \${ruleId}\`);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

seed();
