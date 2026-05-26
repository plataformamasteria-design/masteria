import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { teams, usersToTeams, users } = require('./src/lib/db/schema');
const { eq, ilike } = require('drizzle-orm');

async function main() {
    const t = await db.select().from(teams).where(ilike(teams.name, '%seção de vendas%'));
    console.log('Equipes:', t);
    
    if (t.length > 0) {
        const teamId = t[0].id;
        const usersT = await db.select().from(usersToTeams).where(eq(usersToTeams.teamId, teamId));
        console.log('Membros:', usersT);
        
        for (const ut of usersT) {
            const u = await db.select().from(users).where(eq(users.id, ut.userId));
            console.log('Usuário:', u[0].name, 'Status:', u[0].status);
        }
    }
    process.exit(0);
}
main();
