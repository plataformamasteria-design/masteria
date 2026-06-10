import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { sql, eq, and } from 'drizzle-orm';
import { userNotifications } from './src/lib/db/schema';

async function test() {
  const userId = 'test-user-id';
  
  const query = db
      .select({ count: sql<number>`count(*)` })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false)
        )
      );
      
  console.log("SQL:", query.toSQL());
}

test().catch(console.error).finally(() => process.exit(0));
