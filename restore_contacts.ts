import { db } from './src/lib/db';
import { contacts, conversations, kanbanLeads, contactsToTags } from './src/lib/db/schema';
import { eq, ne, and, sql } from 'drizzle-orm';

async function restoreContacts() {
  console.log('Finding cross-tenant conversations...');
  
  // Find conversations where companyId != contact.companyId
  const crossTenantConvs = await db.execute(sql`
    SELECT c.id as conv_id, c.company_id as conv_company_id, c.contact_id, ct.phone, ct.name, ct.whatsapp_name, ct.avatar_url 
    FROM conversations c
    INNER JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.company_id != ct.company_id
  `);

  const rows = Array.isArray(crossTenantConvs) ? crossTenantConvs : (crossTenantConvs as any).rows;
  console.log(`Found ${rows.length} cross-tenant conversations.`);

  let fixedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const convCompanyId = row.conv_company_id;
    const oldContactId = row.contact_id;
    const phone = row.phone;
    
    if (!phone) continue;

    console.log(`[${i+1}/${rows.length}] Fixing conversation ${row.conv_id} (phone: ${phone})...`);

    // Check if there is already a contact for this company with this phone
    const existing = await db.select().from(contacts).where(and(eq(contacts.companyId, convCompanyId), eq(contacts.phone, phone))).limit(1);
    
    let targetContactId;
    
    if (existing.length > 0) {
      targetContactId = existing[0].id;
      console.log(`  -> Found existing contact ${targetContactId}`);
    } else {
      // Create new contact for the correct company
      const [newContact] = await db.insert(contacts).values({
        companyId: convCompanyId,
        name: row.name,
        whatsappName: row.whatsapp_name,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        status: 'ACTIVE'
      }).returning();
      targetContactId = newContact.id;
      console.log(`  -> Created new contact ${targetContactId}`);
    }
    
    // Fix conversation
    await db.update(conversations).set({ contactId: targetContactId }).where(eq(conversations.id, row.conv_id));
    
    // Fix kanban leads for this contact and company
    await db.update(kanbanLeads).set({ contactId: targetContactId })
      .where(and(eq(kanbanLeads.contactId, oldContactId), eq(kanbanLeads.companyId, convCompanyId)));
      
    fixedCount++;
  }

  console.log(`Fixed ${fixedCount} conversations by re-isolating contacts per tenant.`);
  process.exit(0);
}

restoreContacts().catch(console.error);
