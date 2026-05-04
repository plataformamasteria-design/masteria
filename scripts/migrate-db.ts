#!/usr/bin/env tsx

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, conn } from '../src/lib/db';
import path from 'path';

async function main() {
  console.log('Starting database migration...');
  
  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'drizzle'),
    });
    
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

main();
