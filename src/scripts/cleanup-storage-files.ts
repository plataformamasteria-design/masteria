// src/scripts/cleanup-storage-files.ts
// Script to clean up the storage_files table in Neon to free up space

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function cleanupStorageFiles() {
    console.log('🧹 Cleaning up storage_files table to free Neon DB space...\n');

    try {
        // 1. Get current table size and row count
        const [sizeResult] = await db.execute<{ size: string; count: number }>(sql`
      SELECT 
        pg_size_pretty(pg_total_relation_size('storage_files')) as size,
        (SELECT count(*) FROM storage_files) as count
    `);

        console.log(`📊 Current storage_files table:`);
        console.log(`   Size: ${(sizeResult as any)?.size || 'unknown'}`);
        console.log(`   Rows: ${(sizeResult as any)?.count || 0}\n`);

        // 2. Delete all rows from storage_files (media files that filled up the DB)
        const deleteResult = await db.execute(sql`DELETE FROM storage_files`);
        console.log(`✅ Deleted all rows from storage_files`);

        // 3. Vacuum the table to actually reclaim space
        console.log('🔧 Running VACUUM to reclaim space...');
        await db.execute(sql`VACUUM storage_files`);

        // 4. Get new size
        const [newSizeResult] = await db.execute<{ size: string }>(sql`
      SELECT pg_size_pretty(pg_total_relation_size('storage_files')) as size
    `);

        console.log(`📊 After cleanup: ${(newSizeResult as any)?.size || 'unknown'}`);
        console.log('\n✅ Cleanup complete! Media files will now be stored on filesystem instead of DB.');

    } catch (error: any) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

cleanupStorageFiles();
