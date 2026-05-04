import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function inspectConnection() {
  const configName = '8276_antonio_pablo_mayara';
  console.log(`🔍 Inspecting connection with config_name: ${configName}...`);
  
  const result = await db.select().from(connections).where(eq(connections.config_name, configName));
  
  if (result.length > 0) {
    console.log('✅ Connection found:');
    console.log(JSON.stringify(result[0], null, 2));
  } else {
    console.log('❌ Connection not found.');
  }
  process.exit(0);
}

inspectConnection();
