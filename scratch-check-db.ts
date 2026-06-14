import { db } from './src/lib/db/index.js';
import { agentMediaLibrary } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
    const media = await db.select().from(agentMediaLibrary).limit(10);
    console.log("Media entries:");
    for (const m of media) {
        console.log(`- ${m.fileName}: ${m.fileUrl}`);
    }
    process.exit(0);
}
main().catch(console.error);
