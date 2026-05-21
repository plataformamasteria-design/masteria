import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding connection_id to messages...');
    await db.execute(sql`ALTER TABLE messages ADD COLUMN connection_id text REFERENCES connections(id) ON DELETE SET NULL;`);
    console.log('Column connection_id added successfully.');
  } catch (e: any) {
    console.log('Error or column already exists (connection_id):', e.message);
  }

  process.exit(0);
}

main();
