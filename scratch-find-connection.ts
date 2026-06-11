import 'dotenv/config';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const conns = await db.select().from(connections).where(eq(connections.connectionType, 'meta_api'));
    console.log('Conexões API Oficial:');
    conns.forEach(c => console.log(`- ${c.config_name} (ID: ${c.id}, Status: ${c.connectionStatus}, PhoneId: ${c.phoneNumberId})`));
}

main().catch(console.error);
