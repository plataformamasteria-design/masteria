import { db } from '../src/lib/db';
import { whatsappDeliveryReports } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    const lastReport = await db
      .select({ sentAt: whatsappDeliveryReports.sentAt })
      .from(whatsappDeliveryReports)
      .orderBy(desc(whatsappDeliveryReports.sentAt))
      .limit(1);

    if (lastReport.length > 0) {
        const lastSentAt = lastReport[0].sentAt;
        const now = Date.now();
        const diff = now - new Date(lastSentAt).getTime();
        
        console.log('lastSentAt raw:', lastSentAt);
        console.log('lastSentAt Date object:', new Date(lastSentAt));
        console.log('now Date object:', new Date(now));
        console.log('diff ms:', diff);
        console.log('diff minutes:', diff / 1000 / 60);
    }

    process.exit(0);
}

main().catch(console.error);
