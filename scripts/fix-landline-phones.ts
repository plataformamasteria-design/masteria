/**
 * Migration Script: Fix Brazilian Landline Phone Numbers
 * 
 * This script identifies and corrects phone numbers that were incorrectly normalized
 * by the old `canonicalizeBrazilPhone` function, which added a 9th digit to landline
 * numbers starting with 2, 3, 4, or 5 after the DDD.
 * 
 * Problem Pattern: +55XX9YYYYYYYY where Y starts with 2, 3, 4, or 5
 * Correct Pattern: +55XXYYYYYYYY (without the 9)
 */

import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { like, and, eq } from 'drizzle-orm';

async function main() {
    console.log('🔍 Starting landline phone number fix migration...');

    // Find all Brazilian contacts that might be affected
    // Pattern: +55 (country) + XX (DDD 2 digits) + 9 + Y (where Y is 2,3,4,5) + 7 more digits
    // These are landlines that incorrectly received a 9
    const affectedContacts = await db.query.contacts.findMany({
        where: like(contacts.phone, '+55%'),
    });

    console.log(`📊 Total Brazilian contacts found: ${affectedContacts.length}`);

    let fixedCount = 0;
    const fixes: { id: string; oldPhone: string; newPhone: string; name: string }[] = [];

    for (const contact of affectedContacts) {
        const phone = contact.phone;

        // Check if it matches the broken pattern:
        // Length 14 (+55XX9YYYYYYYY), where position 5 is '9' and position 6 is 2, 3, 4, or 5
        if (phone.length === 14 && phone.startsWith('+55')) {
            const fifthChar = phone.charAt(5); // Should be '9' (the incorrectly added digit)
            const sixthChar = phone.charAt(6); // Should be 2, 3, 4, or 5 (landline prefix)

            if (fifthChar === '9' && ['2', '3', '4', '5'].includes(sixthChar)) {
                // This is a landline that was incorrectly given a 9
                // Fix: Remove the 9 at position 5
                const correctedPhone = phone.slice(0, 5) + phone.slice(6);

                fixes.push({
                    id: contact.id,
                    oldPhone: phone,
                    newPhone: correctedPhone,
                    name: contact.name || 'Unknown',
                });
            }
        }
    }

    console.log(`🔧 Found ${fixes.length} contacts to fix:`);

    for (const fix of fixes) {
        console.log(`  - ${fix.name}: ${fix.oldPhone} → ${fix.newPhone}`);
    }

    if (fixes.length === 0) {
        console.log('✅ No contacts need fixing. Exiting.');
        process.exit(0);
    }

    // Prompt for confirmation
    console.log('\n⚠️  This will update the phone numbers in the database.');
    console.log('   Press Ctrl+C to cancel or wait 5 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Apply fixes
    for (const fix of fixes) {
        try {
            await db.update(contacts)
                .set({ phone: fix.newPhone })
                .where(eq(contacts.id, fix.id));

            console.log(`✅ Fixed: ${fix.name} (${fix.oldPhone} → ${fix.newPhone})`);
            fixedCount++;
        } catch (error) {
            console.error(`❌ Failed to fix ${fix.name}:`, error);
        }
    }

    console.log(`\n🎉 Migration complete. Fixed ${fixedCount}/${fixes.length} contacts.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
