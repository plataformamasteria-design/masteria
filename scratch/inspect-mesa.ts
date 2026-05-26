import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const mesa = await db.select().from(automationFlows).where(eq(automationFlows.id, '84de750c-3b59-492a-9553-67f1f45192dc'));
  
  if (mesa.length === 0) { 
    console.log('Not found'); 
    process.exit(0); 
  }
  
  const flow = mesa[0];
  // Print ALL raw columns
  const keys = Object.keys(flow);
  for (const key of keys) {
    const val = (flow as any)[key];
    if (typeof val === 'object' && val !== null) {
      console.log(`${key}:`, JSON.stringify(val, null, 2));
    } else {
      console.log(`${key}:`, val);
    }
  }
  
  process.exit(0);
}

main().catch(console.error);
