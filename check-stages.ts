import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { kanbanBoards } = require('./src/lib/db/schema');

async function main() {
    const boards = await db.select().from(kanbanBoards);
    boards.forEach((b: any) => {
        if (b.stages) {
            const stgs = typeof b.stages === 'string' ? JSON.parse(b.stages) : b.stages;
            if (stgs && stgs.length > 0) {
                console.log(`Funil: ${b.name} -> Primeira Etapa: ${stgs[0].title}`);
            }
        }
    });
    process.exit(0);
}
main();
