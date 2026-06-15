import { db } from './src/lib/db/index.js';
import { agentMediaLibrary } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
    const library = await db.query.agentMediaLibrary.findMany({
        where: eq(agentMediaLibrary.organizationId, '2f07bde0-4ccd-4f7e-9a38-42dd5e698d97')
    });
    console.log("Media Library Items:");
    console.log(JSON.stringify(library, null, 2));
    process.exit(0);
}
main().catch(console.error);
