import { db } from './src/lib/db';
import { campaigns, connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const c = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, '61e5342e-3a6e-4250-9964-48a81da94d8a')
  });
  console.log("Campaign:", c?.id, "Company:", c?.companyId, "Conn:", c?.connectionId);
  process.exit(0);
}
run();
