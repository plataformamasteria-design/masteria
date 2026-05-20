import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { crmIntegrations } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function run() {
  const integration = await db
    .select()
    .from(crmIntegrations)
    .where(
      and(
        eq(crmIntegrations.companyId, '4b46233a-26fd-4b03-a4c8-b78163b2a68f'),
        eq(crmIntegrations.provider, 'api4com')
      )
    );

  console.log(JSON.stringify(integration, null, 2));
  process.exit(0);
}

run().catch(console.error);
