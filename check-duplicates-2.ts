import { db } from './src/lib/db/index.js';
import { contacts } from './src/lib/db/schema.js';

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
    
    // Normalize any brazil phone to its 8-digit base
    // Format: 55 + DDD + (9?) + 8digits
    // We want to extract just the 55 + DDD + 8digits
    if (basePhone.startsWith('55') && basePhone.length >= 12 && basePhone.length <= 14) {
      const ddd = basePhone.substring(2, 4);
      const rest = basePhone.substring(4);
      
      if (rest.length === 9 && rest.startsWith('9')) {
        // It has the 9th digit
        basePhone = `55${ddd}${rest.substring(1)}`;
      } else if (rest.length === 8) {
        // It's already the 8-digit base
        basePhone = `55${ddd}${rest}`;
      } else {
        // Leave as is if it doesn't match standard sizes perfectly (e.g. 5588920008007 is 13 digits? Wait. 9200-08007 is 9 digits!)
        // If 55 + 88 + 920008007 = 2 + 2 + 9 = 13 digits.
        // Wait, 920008007 DOES start with 9, but it is actually the real number or with 9th digit?
        // Let's just use the `getPhoneVariations` logic conceptually.
        if (rest.length === 9) {
          basePhone = `55${ddd}${rest.substring(1)}`;
        }
      }
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
