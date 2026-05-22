import { db } from './src/lib/db';
import { companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const c = await db.select().from(companies).where(eq(companies.id, 'f28e5adf-ce84-436b-94c5-cd3941f254b7'));
  console.log(c);
  const users = await db.query.users.findMany({ where: (u, { eq }) => eq(u.companyId, 'f28e5adf-ce84-436b-94c5-cd3941f254b7') });
  console.log(users.length, "users");
  process.exit(0);
}
check().catch(console.error);
