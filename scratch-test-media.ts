import { db } from './src/lib/db';
import { contacts, connections, conversations } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    try {
        // Find contact "Deivid Rodrigues" with phone "88920008007"
        const [contact] = await db.select().from(contacts).where(eq(contacts.phone, '5588920008007'));
        if (!contact) {
            console.log("Contact not found");
            return;
        }

        const companyId = contact.companyId;

        // Find unofficial connection
        const allConns = await db.select().from(connections).where(eq(connections.companyId, companyId));
        const evolutionConn = allConns.find(c => c.connectionType === 'evolution' || c.connectionType === 'baileys');

        if (!evolutionConn) {
            console.log("Evolution connection not found");
            return;
        }

        const instanceName = evolutionConn.sessionName || evolutionConn.id;
        console.log("Testing with instance:", instanceName, "Phone:", contact.phone);

        const base64Media = "data:text/plain;base64,SGVsbG8gV29ybGQ=";

        const res = await evolutionApiService.sendMedia(
            instanceName,
            contact.phone,
            "document",
            base64Media,
            undefined,
            "test.txt"
        );
        console.log("Success:", res);

    } catch (e: any) {
        console.error("ERRO:", e.message);
    }
    process.exit(0);
}

test();
