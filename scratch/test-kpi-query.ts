import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { and, count, eq, gte } from 'drizzle-orm';

async function main() {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // from logs
        const startDate = new Date('2026-04-29T03:00:00.000Z');

        console.log("Executando query...");
        const result = await db.select({ count: count() })
                .from(contacts)
                .where(and(eq(contacts.companyId, companyId), gte(contacts.createdAt, startDate)));
                
        console.log("Resultado:", result);
    } catch (error) {
        console.error("ERRO DETALHADO:");
        console.error(error);
        if (error.code) console.error("Código Postgres:", error.code);
        if (error.message) console.error("Mensagem:", error.message);
    }
    process.exit(0);
}

main();
