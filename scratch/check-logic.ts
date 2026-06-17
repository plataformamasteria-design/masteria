import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    const res = await db.execute(sql`select execution_logic from automation_flows where id = '5fa23500-0607-4cf7-9135-d25e076c760d'`);
    console.log(JSON.stringify(res, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
