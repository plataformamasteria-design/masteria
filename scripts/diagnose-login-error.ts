
import 'dotenv/config';
import { db } from '../src/lib/db';
import { users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';

async function diagnose() {
  console.log('--- Diagnostic Start ---');

  // 1. Check Env Vars
  console.log('1. Checking Environment Variables...');
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET_KEY_CALL'];
  let missing = false;
  for (const v of requiredVars) {
    if (!process.env[v]) {
      console.error(`❌ Missing ${v}`);
      missing = true;
    } else {
      console.log(`✅ ${v} is set`);
    }
  }

  if (missing) {
    console.error('❌ Critical environment variables missing. Aborting.');
    process.exit(1);
  }

  // 2. Test DB Connection
  console.log('\n2. Testing Database Connection...');
  try {
    // Try a simple query
    const result = await db.execute('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // 3. Check User
  const email = 'diegomaninhu@gmail.com';
  console.log(`\n3. Checking user: ${email}...`);
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      console.warn(`⚠️ User not found: ${email}`);
    } else {
      console.log(`✅ User found: ID ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
    }
  } catch (error) {
    console.error('❌ Failed to query user:', error);
    process.exit(1);
  }

  console.log('\n--- Diagnostic Complete ---');
  process.exit(0);
}

diagnose().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
