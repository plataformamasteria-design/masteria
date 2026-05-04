
import 'dotenv/config';
import { db } from "@/lib/db";
import { companies, connections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getWebhookConfig() {
    try {
        const result = await db.select({
            slug: companies.webhookSlug,
            companyName: companies.name,
        })
            .from(companies)
            .innerJoin(connections, eq(companies.id, connections.companyId))
            .where(eq(connections.connectionType, 'instagram'))
            .limit(1);

        if (result.length > 0) {
            console.log(`\n--- CONFIGURAÇÃO DO WEBHOOK ---`);
            console.log(`SLUG: ${result[0]!.slug}`);
            console.log(`TOKEN (Sugestão): masteria_secure_token_2025`);
            console.log(`-------------------------------`);
        } else {
            console.log("Nenhuma empresa com conexão Instagram encontrada.");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

getWebhookConfig();
