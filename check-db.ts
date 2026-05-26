const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { companies, kanbanBoards } = require('./src/lib/db/schema');
const { ilike, eq } = require('drizzle-orm');

async function main() {
    const matchedCompanies = await db.select().from(companies).where(ilike(companies.name, '%Empresa de Desenvolvimento Master%'));
    console.log('Companies:');
    matchedCompanies.forEach(c => console.log(`${c.id} - ${c.name}`));
    
    if (matchedCompanies.length > 0) {
        const companyId = matchedCompanies[0].id;
        const allBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
        console.log('\nBoards in DB:');
        allBoards.forEach(b => {
            console.log(`${b.id} - ${b.name} (${b.companyId})`);
            const stages = typeof b.stages === 'string' ? JSON.parse(b.stages) : b.stages;
            if (stages) {
                stages.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
            }
        });
    }
    
    process.exit(0);
}

main();
