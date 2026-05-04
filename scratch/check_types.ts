import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    const res = await db.execute(sql`SELECT id, config_name, connection_type, is_active, status FROM connections`);
    console.log(res);
    process.exit(0);
}
main();
