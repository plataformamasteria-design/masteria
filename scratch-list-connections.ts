import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env' });

async function main() {
    const { db } = await import('./src/lib/db');
    const { connections } = await import('./src/lib/db/schema');
    const all = await db.select({ id: connections.id, name: connections.config_name, type: connections.connectionType }).from(connections);
    console.log(all);
    process.exit(0);
}
main().catch(console.error);
