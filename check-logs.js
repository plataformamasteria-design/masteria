const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { automationFlows } = require('./src/lib/db/schema');
const { eq } = require('drizzle-orm');

async function main() {
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.name, 'Formulario GCR - Aplicação')
    });
    if (!flow) {
        console.log('Flow not found');
        process.exit();
    }
    
    let logic = flow.executionLogic;
    if (typeof logic === 'string') logic = JSON.parse(logic);
    let steps = Array.isArray(logic) ? logic : (logic.steps || []);
    
    for (let step of steps) {
        if (step.type === 'update_contact') {
            console.log(JSON.stringify(step.data.fields, null, 2));
        }
    }
    process.exit();
}
main();
