import fs from 'fs';
import postgres from 'postgres';
import { randomUUID } from 'crypto';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  // Read CSV
  const csvContent = fs.readFileSync('attached_assets/2-lista-leads-sms - Página1_1764208720953.csv', 'utf8');
  const lines = csvContent.split('\n');
  
  const companyId = '682b91ea-15ee-42da-8855-70309b237008';
  const listId = '46da29d3-038f-49df-b7a3-fb3e6b2a9cb6';
  
  const contacts: Array<{phone: string; name: string; id?: string}> = [];
  const seen = new Set<string>();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    const phone = parts[parts.length - 1]?.toString().trim();
    
    if (!phone || phone.length < 10 || isNaN(Number(phone))) continue;
    
    const formattedPhone = '+55' + phone.replace(/\D/g, '');
    if (formattedPhone.length < 13) continue;
    
    if (seen.has(formattedPhone)) continue;
    seen.add(formattedPhone);
    
    contacts.push({
      phone: formattedPhone,
      name: 'Lead SMS ' + formattedPhone.slice(-4)
    });
  }
  
  console.log(`Total contacts from CSV: ${contacts.length}`);
  
  // Get ALL existing contacts for this company
  const existingContacts = await sql`
    SELECT id, phone FROM contacts WHERE company_id = ${companyId}
  `;
  
  const phoneToId = new Map(existingContacts.map(c => [c.phone, c.id]));
  console.log(`Existing contacts in company: ${phoneToId.size}`);
  
  // Get contacts already in this list
  const existingInList = await sql`
    SELECT contact_id FROM contacts_to_contact_lists WHERE list_id = ${listId}
  `;
  const alreadyInList = new Set(existingInList.map(r => r.contact_id));
  console.log(`Contacts already in list LEAD-SMS2: ${alreadyInList.size}`);
  
  // Separate contacts into: need to create, need to link
  const toCreate: typeof contacts = [];
  const toLink: string[] = [];
  
  for (const contact of contacts) {
    const existingId = phoneToId.get(contact.phone);
    if (existingId) {
      // Contact exists - check if already in list
      if (!alreadyInList.has(existingId)) {
        toLink.push(existingId);
      }
    } else {
      // Contact doesn't exist - need to create
      toCreate.push(contact);
    }
  }
  
  console.log(`Contacts to create: ${toCreate.length}`);
  console.log(`Existing contacts to link: ${toLink.length}`);
  
  // Insert NEW contacts in batches
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < toCreate.length; i += batchSize) {
    const batch = toCreate.slice(i, i + batchSize);
    
    // Assign IDs
    for (const contact of batch) {
      contact.id = randomUUID();
    }
    
    // Insert contacts
    await sql`
      INSERT INTO contacts ${sql(batch.map(c => ({
        id: c.id!,
        company_id: companyId,
        name: c.name,
        phone: c.phone,
        status: 'active'
      })))}
    `;
    
    // Link to list
    await sql`
      INSERT INTO contacts_to_contact_lists ${sql(batch.map(c => ({
        contact_id: c.id!,
        list_id: listId
      })))}
    `;
    
    inserted += batch.length;
    console.log(`Progress: ${inserted}/${toCreate.length} new contacts inserted`);
  }
  
  // Link EXISTING contacts in batches
  let linked = 0;
  for (let i = 0; i < toLink.length; i += batchSize) {
    const batch = toLink.slice(i, i + batchSize);
    
    await sql`
      INSERT INTO contacts_to_contact_lists ${sql(batch.map(id => ({
        contact_id: id,
        list_id: listId
      })))}
      ON CONFLICT DO NOTHING
    `;
    
    linked += batch.length;
    console.log(`Progress: ${linked}/${toLink.length} existing contacts linked`);
  }
  
  console.log(`\n✅ Done!`);
  console.log(`   - Created ${inserted} new contacts`);
  console.log(`   - Linked ${linked} existing contacts`);
  
  // Verify count
  const finalCount = await sql`
    SELECT COUNT(*) as count FROM contacts_to_contact_lists WHERE list_id = ${listId}
  `;
  console.log(`\nTotal contacts in LEAD-SMS2: ${finalCount[0].count}`);
  
  await sql.end();
}

main().catch(console.error);
