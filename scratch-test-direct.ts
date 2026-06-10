import { db } from './src/lib/db';
import { contacts, connections, conversations, companies } from './src/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    try {
        const [contact] = await db.select().from(contacts).where(eq(contacts.phone, '5588920008007'));
        if (!contact) {
            console.log("Contact not found");
            return;
        }

        const [company] = await db.select().from(companies).where(eq(companies.id, contact.companyId));
        console.log("Company:", company?.name);

        const allConns = await db.select().from(connections).where(eq(connections.companyId, contact.companyId));
        const evolutionConn = allConns.find(c => c.connectionType === 'evolution' || c.connectionType === 'baileys');

        if (!evolutionConn) {
            console.log("Evolution connection not found for this company");
            return;
        }

        const instanceName = evolutionConn.sessionName || evolutionConn.id;
        console.log("Using instance:", instanceName, "Status in DB:", evolutionConn.status);

        // Try to fetch connection state from Evolution API
        try {
            const state = await evolutionApiService.getConnectionState(instanceName);
            console.log("Evolution API Instance State:", JSON.stringify(state));
        } catch (e: any) {
            console.error("Failed to get state:", e.message);
        }

        // Generate a 1x1 transparent PNG in base64
        const pngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        console.log("\nAttempting to send IMAGE...");
        try {
            const res = await evolutionApiService.sendMedia(
                instanceName,
                contact.phone,
                "image",
                pngBase64,
                "Test Image",
                "test.png",
                "image/png"
            );
            console.log("SUCCESS Image:", res);
        } catch (e: any) {
            console.error("ERROR Image:", e.message);
        }

        // Generate a simple text document in base64
        const docBase64 = "data:text/plain;base64,SGVsbG8gV29ybGQgdGVzdGUgZG9jdW1lbnRv";
        console.log("\nAttempting to send DOCUMENT...");
        try {
            const res = await evolutionApiService.sendMedia(
                instanceName,
                contact.phone,
                "document",
                docBase64,
                undefined,
                "test.txt",
                "text/plain"
            );
            console.log("SUCCESS Document:", res);
        } catch (e: any) {
            console.error("ERROR Document:", e.message);
        }

    } catch (e: any) {
        console.error("FATAL ERRO:", e.message);
    }
    process.exit(0);
}

test();
