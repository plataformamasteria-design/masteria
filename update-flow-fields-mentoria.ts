const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { automationFlows } = require('./src/lib/db/schema');
const { eq, ilike } = require('drizzle-orm');

async function main() {
    try {
        const flows = await db.query.automationFlows.findMany({
            where: ilike(automationFlows.name, '%Formulario Mentoria - Aplicação%')
        });
        
        if (flows.length === 0) {
            console.log('Flow not found.');
            process.exit(1);
        }
        
        const flow = flows[0];
        console.log(`Flow found: ${flow.id} - ${flow.name}`);
        
        let logic = flow.executionLogic;
        if (typeof logic === 'string') logic = JSON.parse(logic);
        let steps = Array.isArray(logic) ? logic : (logic.steps || []);
        
        let visualData = flow.visualData;
        if (typeof visualData === 'string') visualData = JSON.parse(visualData);
        let nodes = visualData?.nodes || [];
        
        const fieldsToAdd = [
            { name: 'nome', value: '{{body.respondent.answers.Qual o seu nome completo?}}' },
            { name: 'telefone', value: '{{body.respondent.answers.Descreva um número que podemos entrar em contato}}' },
            { name: 'email', value: '{{body.respondent.answers.Digite seu melhor e-mail}}' },
            { name: 'cargo', value: '{{body.respondent.answers.Qual o seu cargo na empresa?}}' },
            { name: 'instagram', value: '{{body.respondent.answers.Qual o @ do seu Instagram?}}' },
            { name: 'nicho', value: '{{body.respondent.answers.Qual é o seu nicho/área de atuação?}}' },
            { name: 'colaboradores', value: '{{body.respondent.answers.Quantos colaboradores você tem na sua empresa atualmente?}}' },
            { name: 'pq_ideal', value: '{{body.respondent.answers.Por que você acredita que o Antonio Fogaça é a pessoa ideal para acelerar a sua empresa?}}' },
            { name: 'faturamento', value: '{{body.respondent.answers.E qual o faturamento médio mensal da sua empresa?}}' },
            { name: 'utm_source', value: '{{body.respondent.respondent_utms.utm_source}}' },
            { name: 'utm_medium', value: '{{body.respondent.respondent_utms.utm_medium}}' },
            { name: 'utm_campaign', value: '{{body.respondent.respondent_utms.utm_campaign}}' },
            { name: 'utm_term', value: '{{body.respondent.respondent_utms.utm_term}}' },
            { name: 'utm_content', value: '{{body.respondent.respondent_utms.utm_content}}' },
            { name: 'gclid', value: '{{body.respondent.respondent_utms.gclid}}' },
            { name: 'fbclid', value: '{{body.respondent.respondent_utms.fbclid}}' }
        ];

        let updated = false;

        // Update executionLogic
        for (let step of steps) {
            if (step.type === 'update_contact') {
                step.data = step.data || {};
                step.data.fields = fieldsToAdd;
                updated = true;
                console.log(`Updated executionLogic step ${step.id}`);
            }
        }
        
        // Update visualData
        for (let node of nodes) {
            if (node.type === 'update_contact') {
                node.data = node.data || {};
                node.data.fields = fieldsToAdd;
                updated = true;
                console.log(`Updated visualData node ${node.id}`);
            }
        }
        
        if (updated) {
            const newLogic = Array.isArray(logic) ? steps : { ...logic, steps };
            const newVisualData = { ...visualData, nodes };
            
            await db.update(automationFlows)
                .set({ 
                    executionLogic: newLogic,
                    visualData: newVisualData
                })
                .where(eq(automationFlows.id, flow.id));
                
            console.log('Successfully updated automation flow (visualData & executionLogic).');
        } else {
            console.log('Node update_contact not found in flow.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
