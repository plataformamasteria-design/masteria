const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { automationFlows } = require('./src/lib/db/schema');
const { ilike } = require('drizzle-orm');

async function main() {
    const flows = await db.query.automationFlows.findMany({
        where: ilike(automationFlows.name, '%Formulario GCR - Aplicação%')
    });
    
    console.log(`Found ${flows.length} flows matching name`);
    for (const f of flows) {
        console.log(`- Flow ID: ${f.id} | Name: ${f.name} | Active: ${f.isActive} | CreatedAt: ${f.createdAt}`);
        
        // Count update_contact nodes
        let logic = f.executionLogic;
        if (typeof logic === 'string') logic = JSON.parse(logic);
        let steps = Array.isArray(logic) ? logic : (logic.steps || []);
        
        const updateNodes = steps.filter(s => s.type === 'update_contact');
        console.log(`  -> Has ${updateNodes.length} 'update_contact' nodes`);
        
        for (const n of updateNodes) {
             console.log(`  -> Node ${n.id} has ${n.data?.fields?.length || 0} fields mapped.`);
             if (n.data?.fields?.length > 0) {
                 console.log(`     Fields: ${n.data.fields.map(x => x.name).join(', ')}`);
             }
        }
    }
    process.exit();
}
main();
