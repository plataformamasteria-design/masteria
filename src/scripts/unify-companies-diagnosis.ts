
import { db } from '../lib/db/index';
import { companies, users, contacts, tags, contactLists, campaigns } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 Diagnosing Company Unification...');

  // 1. Find Companies
  const allCompanies = await db.select().from(companies);
  
  const sourceName = "Diego Abner Rodrigues Santana's Company e3eff191";
  const targetName = "Diego's Company";

  const sourceCompany = allCompanies.find(c => c.name === sourceName);
  const targetCompany = allCompanies.find(c => c.name === targetName);

  if (!sourceCompany) {
    console.error(`❌ Source company "${sourceName}" not found.`);
    return;
  }
  if (!targetCompany) {
    console.error(`❌ Target company "${targetName}" not found.`);
    return;
  }

  console.log(`\n🏢 Source Company: ${sourceCompany.name} (ID: ${sourceCompany.id})`);
  console.log(`🏢 Target Company: ${targetCompany.name} (ID: ${targetCompany.id})`);

  // 2. Count Records
  console.log('\n📊 Record Counts (Source):');
  
  const tablesToCheck = [
    { name: 'users', table: users },
    { name: 'contacts', table: contacts },
    { name: 'tags', table: tags },
    { name: 'contactLists', table: contactLists },
    { name: 'campaigns', table: campaigns },
  ];

  for (const t of tablesToCheck) {
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(t.table)
      .where(eq(t.table.companyId, sourceCompany.id));
    if (count[0]) {
      console.log(`- ${t.name}: ${count[0].count}`);
    } else {
      console.log(`- ${t.name}: 0`);
    }
  }

  // 3. Check Conflicts
  console.log('\n⚠️ Checking for Conflicts (Duplicates in Target):');

  // Users (Email)
  const sourceUsers = await db.select().from(users).where(eq(users.companyId, sourceCompany.id));
  const targetUsers = await db.select().from(users).where(eq(users.companyId, targetCompany.id));
  const userConflicts = sourceUsers.filter(su => targetUsers.some(tu => tu.email === su.email));
  console.log(`- Users (Email Conflicts): ${userConflicts.length}`);
  if (userConflicts.length > 0) {
    userConflicts.forEach(u => console.log(`  - ${u.email}`));
  }

  // Contacts (Phone)
  // Fetching all contacts might be heavy, let's count conflicts via SQL if possible or just fetch phones
  const sourceContacts = await db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.companyId, sourceCompany.id));
  const targetContacts = await db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.companyId, targetCompany.id));
  const sourcePhones = new Set(sourceContacts.map(c => c.phone));
  const targetPhones = new Set(targetContacts.map(c => c.phone));
  
  let contactConflicts = 0;
  for (const p of sourcePhones) {
    if (targetPhones.has(p)) contactConflicts++;
  }
  console.log(`- Contacts (Phone Conflicts): ${contactConflicts}`);

  // Tags (Name)
  const sourceTags = await db.select().from(tags).where(eq(tags.companyId, sourceCompany.id));
  const targetTags = await db.select().from(tags).where(eq(tags.companyId, targetCompany.id));
  const tagConflicts = sourceTags.filter(st => targetTags.some(tt => tt.name === st.name));
  console.log(`- Tags (Name Conflicts): ${tagConflicts.length}`);
  if (tagConflicts.length > 0) {
    tagConflicts.forEach(t => console.log(`  - ${t.name}`));
  }

  // Contact Lists (Name)
  const sourceLists = await db.select().from(contactLists).where(eq(contactLists.companyId, sourceCompany.id));
  const targetLists = await db.select().from(contactLists).where(eq(contactLists.companyId, targetCompany.id));
  const listConflicts = sourceLists.filter(sl => targetLists.some(tl => tl.name === sl.name));
  console.log(`- Contact Lists (Name Conflicts): ${listConflicts.length}`);
  if (listConflicts.length > 0) {
    listConflicts.forEach(l => console.log(`  - ${l.name}`));
  }

  process.exit(0);
}

diagnose().catch(console.error);
