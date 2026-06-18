import { db } from '../src/lib/db';
async function run() {
    const all = await db.query.companies.findMany();
    console.log(all.map(c => c.name));
    process.exit(0);
}
run();
