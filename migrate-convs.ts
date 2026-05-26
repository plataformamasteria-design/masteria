import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { conversations } = require('./src/lib/db/schema');
const { eq } = require('drizzle-orm');

async function main() {
    try {
        const oldConnId = '26c20a74-01d0-44e8-b2c8-4af5f3146ca1';
        const newConnId = '36bca632-4df0-49bb-899e-0a0ed53ccdff';
        
        const convs = await db.select().from(conversations).where(eq(conversations.connectionId, oldConnId));
        console.log('Conversations attached to old connection:', convs.length);
        
        if (convs.length > 0) {
            console.log('Migrating conversations to new connection...');
            await db.update(conversations)
                .set({ connectionId: newConnId })
                .where(eq(conversations.connectionId, oldConnId));
            console.log('Migration complete.');
        }
    } catch(e) {
        console.log('Erro:', e);
    }
    process.exit(0);
}
main();
