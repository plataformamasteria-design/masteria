import { db } from './src/lib/db';
import { campaigns, whatsappDeliveryReports } from './src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function run() {
  try {
    const latestCampaign = await db.query.campaigns.findFirst({
      orderBy: [desc(campaigns.createdAt)],
    });
    
    if (latestCampaign) {
        console.log("Campaign:", {
            id: latestCampaign.id,
            name: latestCampaign.name,
            status: latestCampaign.status
        });
        
        const execs = await db.select().from(whatsappDeliveryReports)
            .where(eq(whatsappDeliveryReports.campaignId, latestCampaign.id))
            .limit(5)
            .orderBy(desc(whatsappDeliveryReports.sentAt));
        
        console.log("Executions:", execs.map((e: any) => ({
            contactId: e.contactId,
            status: e.status,
            error: e.failureReason
        })));
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
