import { db } from './src/lib/db/index.js';
import { storageFiles } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        console.log('Testing DB connection...');
        const file = await db.query.storageFiles.findFirst({
            where: eq(storageFiles.key, 'nonexistent_key')
        });
        console.log('DB query successful! Table exists.', file);
    } catch (err: any) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}
main();
