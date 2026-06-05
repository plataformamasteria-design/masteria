import { db } from './src/lib/db';
import { agentMediaLibrary } from './src/lib/db/schema';

async function test() {
  const files = await db.select().from(agentMediaLibrary).limit(1);
  console.log(files);
}
test().catch(console.error);
