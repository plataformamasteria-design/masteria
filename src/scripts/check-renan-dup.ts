
import { db } from '../lib/db';
import { contacts } from '../lib/db/schema';
import { like } from 'drizzle-orm';

async function checkDuplicates() {
    console.log('🔍 Searching contacts by phone part "981148823"...');
    const results = await db.select().from(contacts).where(like(contacts.phone, '%981148823%'));
    
    results.forEach(c => {
        console.log(`found: ${c.name} - ${c.phone} (ID: ${c.id})`);
    });
}

checkDuplicates();
