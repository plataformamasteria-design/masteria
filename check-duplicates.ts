import { db } from './src/lib/db/index.js';
import { contacts } from './src/lib/db/schema.js';
import { canonicalizeBrazilPhone } from './src/lib/utils.js';

async function findDuplicates() {
  const allContacts = await db.select({
    id: contacts.id,
    phone: contacts.phone,
    name: contacts.name,
    companyId: contacts.companyId
  }).from(contacts);

  const grouped = new Map<string, typeof allContacts>();

  for (const c of allContacts) {
    if (!c.phone) continue;
    
    // Simplification for exact match or 9-digit variation mapping
    let basePhone = c.phone;
    if (basePhone.length === 13 && basePhone.startsWith('55')) {
      const ddd = basePhone.substring(2, 4);
      const rest = basePhone.substring(4);
      if (rest.length === 9 && rest.startsWith('9')) {
        basePhone = `55${ddd}${rest.substring(1)}`;
      }
    } else if (basePhone.length === 12 && basePhone.startsWith('55')) {
      // already base
    }

    const key = `${c.companyId}_${basePhone}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(c);
  }

  const duplicates = [];
  for (const [key, group] of grouped.entries()) {
    if (group.length > 1) {
      duplicates.push({
        basePhone: key.split('_')[1],
        companyId: key.split('_')[0],
        contacts: group
      });
    }
  }

  console.log(JSON.stringify(duplicates, null, 2));
  console.log(`\nTotal duplicate groups found: ${duplicates.length}`);
  process.exit(0);
}

findDuplicates().catch(console.error);
