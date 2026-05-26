import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { contacts, kanbanLeads } = require('./src/lib/db/schema');
const { isNotNull } = require('drizzle-orm');

async function main() {
    const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    const c = await db.select().from(contacts).where(isNotNull(contacts.customFields)).limit(1);
    console.log('Contact CF:', JSON.stringify(c[0]?.customFields, null, 2));
    
    process.exit(0);
}
main();
