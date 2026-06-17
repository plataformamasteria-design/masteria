import { db } from '../src/lib/db';
import { messages, connections, campaigns, whatsappDeliveryReports } from '../src/lib/db/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import fs from 'fs';

async function main() {
  console.log('Fetching duplicated Meta messages...');
  
  // Find messages that share the same conversation_id and content/template, sent very close to each other.
  // We can just look for whatsappDeliveryReports with the same contactId and campaignId.
  const duplicatedReports = await db.execute(sql`
    SELECT contact_id, campaign_id, COUNT(*) as count 
    FROM whatsapp_delivery_reports 
    GROUP BY contact_id, campaign_id 
    HAVING COUNT(*) > 1 
    ORDER BY count DESC 
    LIMIT 20
  `);

  if (duplicatedReports.rows.length > 0) {
    console.log('Found duplicates in whatsappDeliveryReports!');
    console.log(duplicatedReports.rows);
    
    // Pick one example to see the timestamps
    const example = duplicatedReports.rows[0];
    const details = await db.select().from(whatsappDeliveryReports).where(
      and(
        eq(whatsappDeliveryReports.contactId, example.contact_id as string),
        eq(whatsappDeliveryReports.campaignId, example.campaign_id as string)
      )
    ).orderBy(whatsappDeliveryReports.createdAt);
    
    console.log('\nExample duplicate reports:');
    console.log(details.map(d => ({
        id: d.id,
        status: d.status,
        providerId: d.providerMessageId,
        createdAt: d.createdAt,
    })));
  } else {
    console.log('No duplicates found in whatsappDeliveryReports.');
  }

  // Also check messages table for duplicates within a short timeframe
  const duplicatedMessages = await db.execute(sql`
    SELECT m.contact_id, m.content, m.sender_type, COUNT(*) as count
    FROM (
      SELECT conversation_id as contact_id, content, sender_type, sent_at
      FROM messages
      WHERE sender_type = 'AGENT' AND sent_at > NOW() - INTERVAL '7 days'
    ) m
    GROUP BY m.contact_id, m.content, m.sender_type
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\nDuplicate messages (grouped by conversation & content):');
  console.log(duplicatedMessages.rows);

  process.exit(0);
}

main().catch(console.error);
