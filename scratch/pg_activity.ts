import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('Checking Postgres Activity...');
    const res = await db.execute(sql`
        SELECT pid, usename, state, wait_event_type, wait_event, query_start, state_change, query
        FROM pg_stat_activity
        WHERE state != 'idle'
        ORDER BY query_start ASC;
    `);
    console.table(res);
    process.exit(0);
}
main().catch(console.error);
