import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts, connections } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
    const leads = await db.select().from(contacts).where(ilike(contacts.name, '%Deivid Rodrigues%'));
    console.log(`Leads encontrados: ${leads.length}`);
    for (const lead of leads) {
        console.log(`- Lead: ${lead.name} | Phone: ${lead.phone} | TeamId: ${lead.teamId}`);
        if (lead.teamId) {
            const conns = await db.select().from(connections).where(eq(connections.teamId, lead.teamId));
            console.log(`  Conexões da equipe:`, conns.map(c => c.config_name + ' (Type: ' + c.connectionType + ')'));
        }
    }
}

main().catch(console.error);
