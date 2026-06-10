import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { evolutionApiService } from './src/services/evolution-api.service';

async function main() {
  const conns = await db.select().from(connections).where(ilike(connections.config_name, '%Camila%'));
  console.log("Found connections:", conns.map(c => ({ id: c.id, name: c.config_name, sessionName: c.sessionName })));
  
  if (conns.length > 0) {
    for (const c of conns) {
      const instanceName = c.sessionName || c.id;
      console.log(`Checking status for ${instanceName}...`);
      try {
        const state = await evolutionApiService.getConnectionState(instanceName);
        console.log(`State for ${instanceName}:`, state);
      } catch (e: any) {
        console.log(`Error checking state for ${instanceName}:`, e.message);
      }
    }
  }
  process.exit(0);
}
main();
