import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function activateConnection() {
  const configName = '8276_antonio_pablo_mayara';
  console.log(`🚀 Activating connection: ${configName}...`);
  
  const result = await db.update(connections)
    .set({ 
      isActive: true,
      status: 'connected' // Set explicit status
    })
    .where(eq(connections.config_name, configName))
    .returning();
    
  if (result.length > 0) {
    console.log('✅ Connection activated!');
    console.log(JSON.stringify(result[0], null, 2));
  } else {
    console.log('❌ Connection not found to update.');
  }
  process.exit(0);
}

activateConnection();
