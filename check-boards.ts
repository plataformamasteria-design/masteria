import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { kanbanBoards } = require('./src/lib/db/schema');
const { eq } = require('drizzle-orm');

async function main() {
    const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    const allBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, COMPANY_ID));
    allBoards.forEach((b: any) => console.log(b.name, b.id));
    process.exit(0);
}
main();
