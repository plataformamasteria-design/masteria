import 'dotenv/config';
import { db } from '../src/lib/db/index.js';
import { superadminBoards } from '../src/lib/db/schema.js';

async function test() {
    try {
        const boards = await db.select().from(superadminBoards);
        console.log(JSON.stringify(boards, null, 2));
    } catch(err) {
        console.error(err);
    }
}
test();
