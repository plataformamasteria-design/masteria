import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('🔄 Attempting to connect to Neon Postgres...');
console.log(`   URL: ${connectionString.replace(/:[^:@]*@/, ':****@')}`); // Hide password

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    const result = await db.execute(sql`SELECT 1 as connected`);
    console.log('✅ Connection Successful!');
    console.log('   Result:', result);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Connection Failed!');
    console.error('   Error Code:', error.code);
    console.error('   Message:', error.message);
    if (error.cause) {
        console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
}

testConnection();