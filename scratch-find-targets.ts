import { db } from './src/lib/db';
import { campaigns, contactLists, contactsToContactLists, tags, contactsToTags, contacts } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const campaignId = 'a92b6169-ca99-41c9-9c61-feac6a0d419c';
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId)
  });

  if (!campaign) {
    console.log("Campaign not found");
    return;
  }
  
  console.log(`Campaign target list ID: ${campaign.contactListId}`);
  console.log(`Campaign target tags: ${campaign.targetTags}`);

  if (campaign.contactListId) {
    const listContacts = await db.select({ contactId: contactsToContactLists.contactId })
      .from(contactsToContactLists)
      .where(eq(contactsToContactLists.listId, campaign.contactListId));
    console.log(`Contacts in list: ${listContacts.length}`);
  }

  // Also check if there's a delivery report table if needed...
  
  process.exit(0);
}

main().catch(console.error);
