import { db } from '../src/lib/db';
import { kanbanLeads, contacts } from '../src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const boardId = 'b8856169-d5ee-40ea-a876-20c8b46234cf';
  
  const leads = await db.select().from(kanbanLeads).where(eq(kanbanLeads.boardId, boardId));
  const contactIds = leads.map(l => l.contactId);
  if (contactIds.length === 0) return;

  const allContacts = await db.select().from(contacts).where(inArray(contacts.id, contactIds));
  
  let toUpdate = 0;
  let removedKeysCount = new Map<string, number>();

  for (const contact of allContacts) {
    let cf = contact.customFields;
    if (typeof cf === 'string') {
      try { cf = JSON.parse(cf); } catch (e) { cf = null; }
    }

    if (cf && typeof cf === 'object') {
      const entries = Object.entries(cf).filter(([k, v]) => v !== null && v !== undefined && v !== '');
      const valueMap = new Map<string, string[]>();
      
      for (const [key, value] of entries) {
        const strVal = String(value).trim();
        if (!strVal) continue;
        if (!valueMap.has(strVal)) valueMap.set(strVal, []);
        valueMap.get(strVal)!.push(key);
      }

      let modified = false;
      const newCf = { ...cf } as any;

      for (const [val, keys] of valueMap.entries()) {
        if (keys.length > 1) {
          // Sort keys by length ascending
          keys.sort((a, b) => a.length - b.length);
          
          const shortest = keys[0];
          // If shortest is reasonable, remove the longer ones that are questions
          for (let i = 1; i < keys.length; i++) {
            const longer = keys[i];
            // Safe heuristic: if the longer key is at least 5 chars longer, and has > 20 chars, remove it.
            if (longer.length > 20 && (longer.length - shortest.length > 5)) {
              delete newCf[longer];
              modified = true;
              removedKeysCount.set(longer, (removedKeysCount.get(longer) || 0) + 1);
            }
          }
        }
      }

      if (modified) {
        // Update contact in DB
        await db.update(contacts)
          .set({ customFields: newCf })
          .where(eq(contacts.id, contact.id));
        toUpdate++;
      }
    }
  }

  console.log(`Updated ${toUpdate} contacts.`);
  console.log("Removed keys count:");
  for (const [k, v] of removedKeysCount.entries()) {
    console.log(`- "${k}": ${v} times`);
  }

  process.exit(0);
}

main().catch(console.error);
