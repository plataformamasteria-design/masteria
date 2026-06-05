import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixUser() {
    try {
        console.log('Updating user to correct company...');
        await db.update(users)
            .set({ companyId: '7cb4773e-1fab-4699-b35d-c70d9f8d9149' })
            .where(eq(users.id, '2c7ddbc3-3883-4d25-b79f-27234a079f8c'));
        console.log('Done.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

fixUser();
