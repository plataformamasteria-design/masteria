import { db } from '../src/lib/db';
import { whatsappDeliveryReports } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
async function run() {
    const reports = await db.query.whatsappDeliveryReports.findMany({
        where: eq(whatsappDeliveryReports.campaignId, '0ff54be0-d002-4f0c-90f4-062c9a115bf9')
    });
    console.log("Delivery Reports:", reports);
    process.exit(0);
}
run();
