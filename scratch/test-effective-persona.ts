import { db } from '../src/lib/db';
import { conversations } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function test() {
  const convs = await db.select({ id: conversations.id }).from(conversations).orderBy(desc(conversations.createdAt)).limit(1);
  if (convs.length > 0) {
    const res = await fetch(`http://localhost:3000/api/v1/conversations/${convs[0].id}/effective-persona`, {
      headers: { cookie: 'supersession=YOUR_SESSION_COOKIE_IF_NEEDED' } // NextJS might block if not authenticated
    });
    console.log(res.status);
    console.log(await res.text());
  }
}
test();
