import { db } from './src/lib/db';
import { conversations, connections } from './src/lib/db/schema';
import { desc, eq, and, isNull } from 'drizzle-orm';

async function fixConversations() {
  try {
    const activeEvoConn = await db.query.connections.findFirst({
        where: eq(connections.connectionType, 'evolution')
    });
    
    if (activeEvoConn) {
        console.log("Fixing conversations with NULL connectionId to use Evo connection:", activeEvoConn.id);
        const res = await db.update(conversations)
            .set({ connectionId: activeEvoConn.id })
            .where(isNull(conversations.connectionId));
        console.log("Conversations fixed!");
    } else {
        console.log("No Evo connection found");
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fixConversations();
