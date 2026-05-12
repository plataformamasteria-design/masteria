import { db } from './src/lib/db';
import { aiPersonas, conversations } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const companyId = 'aca8c096-cf39-49a5-957a-2819b74ab2ab';
  const personas = await db.select().from(aiPersonas).where(eq(aiPersonas.companyId, companyId));
  
  if (personas.length === 0) {
    console.log('Nenhum bot Douglas encontrado.');
  } else {
    for (const p of personas) {
      console.log(`Persona: ${p.name} (ID: ${p.id})`);
      console.log(`- Company ID: ${p.companyId}`);
      console.log(`- Followup Enabled: ${p.followupEnabled}`);
      console.log(`- Followup Mode: ${p.followupMode}`);
      console.log(`- Followup Delay Minutes: ${p.followupDelayMinutes}`);
      console.log(`- Followup Days Count: ${p.followupDaysCount}`);
      console.log(`- Followup Max Attempts: ${p.followupMaxAttempts}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
