import 'dotenv/config';
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { evolutionApiService } from '../src/services/evolution-api.service';
import { inArray } from 'drizzle-orm';

async function run() {
  const evolutionConns = await db.select().from(connections).where(inArray(connections.connectionType, ['evolution', 'baileys']));
  
  for (const c of evolutionConns) {
    try {
      const state = await evolutionApiService.getConnectionState(c.id);
      console.log(`- ${c.config_name} (${c.id}) -> State:`, state?.instance?.state);
    } catch (e: any) {
      console.log(`- ${c.config_name} (${c.id}) -> Error:`, e.message);
    }
  }
  
  process.exit(0);
}

run();
