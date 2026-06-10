import { db } from './src/lib/db';
import { users } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const userList = await db.select().from(users).where(eq(users.email, 'diegomaninhu@gmail.com'));
    console.log(JSON.stringify(userList, null, 2));
    process.exit(0);
}
main();
