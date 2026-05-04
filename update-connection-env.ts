
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateConnectionEnv() {
  try {
    const connectionId = 'e00e9b1a-99c5-4df5-8a4e-f8565c340cd1';
    console.log(`Updating connection ${connectionId} to development environment...`);
    
    await db.update(connections)
      .set({ environment: 'development' })
      .where(eq(connections.id, connectionId));
      
    console.log('Update successful!');
    
    // Verify
    const updated = await db.select().from(connections).where(eq(connections.id, connectionId));
    console.log('Updated Connection:', JSON.stringify(updated[0], null, 2));
    
  } catch (error) {
    console.error('Error updating connection:', error);
  }
  process.exit(0);
}

updateConnectionEnv();
