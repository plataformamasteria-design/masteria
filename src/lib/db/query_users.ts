import { db } from './index';
import { users } from './schema';

async function main() {
  const allUsers = await db.select().from(users);
  console.log(allUsers.map(u => ({ email: u.email, role: u.role })));
  process.exit(0);
}
main();
