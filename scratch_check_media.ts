import { db } from './src/lib/db';
import { mediaAssets } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const asset = await db.query.mediaAssets.findFirst({
        where: eq(mediaAssets.id, '68bb216f-31b8-4640-a4a9-cc511621bbd5')
    });
    console.log(asset);
    process.exit(0);
}
main().catch(console.error);
