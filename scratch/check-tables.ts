import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        const res = await db.execute(sql`select * from automations where id = '5fa23500-0607-4cf7-9135-d25e076c760d'`);
        console.log('from automations:', res);
    } catch(e) { console.log('no automations'); }

    try {
        const res2 = await db.execute(sql`select * from automation_rules where id = '5fa23500-0607-4cf7-9135-d25e076c760d'`);
        console.log('from automation_rules:', res2);
    } catch(e) { console.log('no automation_rules'); }

    try {
        const res3 = await db.execute(sql`select * from automation_flows where id = '5fa23500-0607-4cf7-9135-d25e076c760d'`);
        console.log('from automation_flows:', res3);
    } catch(e) { console.log('no automation_flows'); }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
