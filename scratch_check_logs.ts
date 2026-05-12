import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from './src/lib/db/index.js';
import { automationLogs } from './src/lib/db/schema.js';
import { desc, like } from 'drizzle-orm';

async function main() {
    const result = await db.select({
        createdAt: automationLogs.createdAt,
        level: automationLogs.level,
        message: automationLogs.message,
        details: automationLogs.details
    })
    .from(automationLogs)
    .where(like(automationLogs.message, '%ransc%'))
    .orderBy(desc(automationLogs.createdAt))
    .limit(10);

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}
main().catch(console.error);
