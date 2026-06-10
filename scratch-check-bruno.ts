import { db } from './src/lib/db';
import { companies, connections, contacts } from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { evolutionApiService } from './src/services/evolution-api.service';

async function check() {
    try {
        const [company] = await db.select().from(companies).where(ilike(companies.name, '%Empresa de Desenvolvimento Master%'));
        if (!company) {
            console.log("Company not found.");
            return;
        }
        console.log("Found Company:", company.name, "| ID:", company.id);

        const all = await db.select().from(connections).where(eq(connections.companyId, company.id));
        const conns = all.filter(c => c.config_name?.toLowerCase().includes('bruno'));

        if (conns.length === 0) {
            console.log("No connection with 'Bruno' in name for this company.");
            console.log("Available connections for this company:");
            all.forEach(c => console.log(`- ${c.config_name} | ${c.sessionName || c.id} | ${c.status}`));
            return;
        }

        const conn = conns[0];
        console.log("\nFound Connection:");
        console.log("Config Name:", conn.config_name);
        console.log("Status:", conn.status);
        console.log("ID:", conn.id);
        const instanceName = conn.sessionName || conn.id;
        console.log("Instance Name:", instanceName);

        try {
            const state = await evolutionApiService.getConnectionState(instanceName);
            console.log("Evolution API State:", JSON.stringify(state));
        } catch(e: any) {
            console.error("Error checking Evolution API state:", e.message);
        }

        // Test send
        const [contact] = await db.select().from(contacts).where(eq(contacts.phone, '5588920008007'));
        if (contact) {
            console.log("\nSending TEST to contact:", contact.phone);
            try {
                const docBase64 = "data:text/plain;base64,SGVsbG8gV29ybGQ=";
                const res = await evolutionApiService.sendMedia(
                    instanceName,
                    contact.phone,
                    "document",
                    docBase64,
                    undefined,
                    "test.txt",
                    "text/plain"
                );
                console.log("Send SUCCESS:", res);
            } catch (e: any) {
                console.error("Send ERROR:", e.message);
            }
        } else {
            console.log("Contact not found in DB.");
        }
    } catch (e: any) {
        console.error("FATAL ERROR:", e.message);
    }
    process.exit(0);
}

check();
