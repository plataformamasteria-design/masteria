import { db } from '../src/lib/db/index.js';
import { sql } from 'drizzle-orm';
async function main() {
    await db.execute(sql`ALTER TABLE campaigns ADD COLUMN automation_flow_id VARCHAR(255);`);
    console.log('Column added');
    process.exit(0);
}
main().catch(console.error);
