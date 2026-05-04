import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function resetConnections() {
  console.log('🔄 Resetting Baileys connections to disconnected state...');
  
  // Update all Baileys connections to status='disconnected' and isActive=true
  // This should force the UI to show the "Scan QR Code" button or "Connect" button
  // instead of thinking it's connected but unhealthy.
  
  const result = await db.update(connections)
    .set({ 
      status: 'disconnected',
      isActive: true, // Keep it active so it appears in the list
      qrCode: null    // Clear old QR code if any
    })
    .where(eq(connections.connectionType, 'baileys'))
    .returning();
    
  console.log(`✅ Updated ${result.length} connections.`);
  result.forEach(c => {
    console.log(`   - ${c.config_name || c.id}: Disconnected`);
  });
  
  process.exit(0);
}

resetConnections();
