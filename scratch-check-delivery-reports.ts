import 'dotenv/config';
import { db } from './src/lib/db';
import { whatsappDeliveryReports } from './src/lib/db/schema';
import { desc, gte } from 'drizzle-orm';

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reports = await db.select()
        .from(whatsappDeliveryReports)
        .where(gte(whatsappDeliveryReports.createdAt, today))
        .orderBy(desc(whatsappDeliveryReports.createdAt))
        .limit(20);

    console.log('Últimos relatórios de entrega do WhatsApp:');
    reports.forEach(r => {
        console.log(`Status: ${r.status} | Phone: ${r.phone} | Erro: ${r.errorDetails}`);
    });
}

main().catch(console.error);
