import { db } from './src/lib/db';
import { messageTemplates } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const t = await db.query.messageTemplates.findFirst({
    where: eq(messageTemplates.name, 'lista2edn7')
  });
  console.log(JSON.stringify(t?.components, null, 2));
  process.exit(0);
}
run();
