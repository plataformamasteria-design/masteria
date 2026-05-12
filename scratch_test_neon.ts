import { db } from './src/lib/db';
import { storageFiles } from './src/lib/db/schema';

async function main() {
    try {
        await db.insert(storageFiles).values({
            companyId: null,
            key: 'test_key_123',
            mimeType: 'text/plain',
            data: Buffer.from('hello world')
        });
        console.log('Inserted successfully!');
        
        const file = await db.query.storageFiles.findFirst({
            where: (t, { eq }) => eq(t.key, 'test_key_123')
        });
        console.log('File found:', file ? 'Yes' : 'No');
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}
main();
