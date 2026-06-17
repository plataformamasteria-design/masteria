import { db } from '../src/lib/db';
import { automationRules } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const flows = await db.query.automationRules.findMany({
        columns: {
            id: true,
            name: true,
            type: true
        }
    });
    console.log(flows);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
