#!/usr/bin/env tsx

import { db, conn } from '../src/lib/db';
import { runSeed } from '../src/scripts/seed-drizzle';

async function main() {
  try {
    await runSeed(db);
    process.exit(0);
  } catch {
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();

