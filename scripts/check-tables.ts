
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkTables() {
  try {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in DB:', result.map((r: any) => r.table_name));
    
    const types = await db.execute(sql`
        SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace
    `);
    console.log('Types in DB:', types.map((t: any) => t.typname));

  } catch (e) {
    console.error('Error checking tables:', e);
  }
  process.exit(0);
}

checkTables();
