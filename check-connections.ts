import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { companies, connections, messages } = require('./src/lib/db/schema');
const { ilike, eq } = require('drizzle-orm');

async function main() {
    const c = await db.select().from(companies).where(ilike(companies.name, '%Henrique Felipe%'));
    console.log('Companhias:', c.map(x => ({ id: x.id, name: x.name })));
    
    if (c.length > 0) {
        const companyId = c[0].id;
        const conns = await db.select().from(connections).where(eq(connections.companyId, companyId));
        console.log('\nConexões:', conns.map(x => ({ id: x.id, name: x.configName || x.sessionName, status: x.status, connectionType: x.connectionType })));
    }
    process.exit(0);
}
main();
