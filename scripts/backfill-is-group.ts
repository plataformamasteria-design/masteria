import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { detectGroup } from '../src/lib/utils/phone';
import { eq } from 'drizzle-orm';

async function backfillIsGroup() {
  console.log('🔄 Starting isGroup backfill...\n');
  
  try {
    const allContacts = await db.select().from(contacts);
    console.log(`📊 Found ${allContacts.length} contacts to process\n`);
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    for (const contact of allContacts) {
      try {
        const isGroup = detectGroup({ phone: contact.phone });
        
        if (contact.isGroup !== isGroup) {
          await db.update(contacts)
            .set({ isGroup })
            .where(eq(contacts.id, contact.id));
          
          console.log(`✅ Updated contact: ${contact.name} (${contact.phone}) → isGroup=${isGroup}`);
          updated++;
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Error processing contact ${contact.id}:`, error);
        errors++;
      }
    }
    
    console.log('\n📈 Backfill Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Unchanged: ${unchanged}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${allContacts.length}\n`);
    
    console.log('✨ Backfill completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
    process.exit(1);
  }
}

backfillIsGroup();
