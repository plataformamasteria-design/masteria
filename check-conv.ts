import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { conversations, connections } = require('./src/lib/db/schema');
const { eq } = require('drizzle-orm');

async function main() {
    try {
        const convId = 'c441f409-6024-4c02-b69a-e2304ce0111c';
        const conv = await db.select().from(conversations).where(eq(conversations.id, convId));
        console.log('Conversation:', conv[0]);
        if (conv[0]) {
            const conn = await db.select().from(connections).where(eq(connections.id, conv[0].connectionId));
            console.log('Connection bound to conversation:', conn[0]);
        }
    } catch(e) {
        console.log('Erro:', e);
    }
    process.exit(0);
}
main();
