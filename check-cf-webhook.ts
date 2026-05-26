import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { contacts } = require('./src/lib/db/schema');
const { ilike } = require('drizzle-orm');

async function main() {
    const c = await db.select().from(contacts).where(ilike(contacts.phone, '%88920008007%')).limit(1);
    if (c.length > 0) {
        console.log('Contact CF for webhook lead:', JSON.stringify(c[0].customFields, null, 2));
    } else {
        console.log('Contact not found');
    }
    process.exit(0);
}
main();
