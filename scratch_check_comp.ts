import { db } from './src/lib/db';
import { messageTemplates } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const t = await db.query.messageTemplates.findMany({
    where: eq(messageTemplates.name, 'lista2edn7')
  });
  t.forEach(x => {
    const h = (x.components as any[])?.find(c => c.type === 'HEADER');
    console.log("ID:", x.id, "Company:", x.companyId, "Handle:", h?.example?.header_handle?.[0]);
  });
  process.exit(0);
}
run();
