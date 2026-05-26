require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { connections, users } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

  const conns = await db.select().from(connections).where(eq(connections.companyId, companyId));
  console.log('\n=== CONNECTIONS ===');
  for (const c of conns) {
    console.log(`  "${(c as any).configName}" | ID: ${c.id} | Status: ${c.status} | Active: ${(c as any).isActive}`);
  }

  // Also list all users
  const allUsers = await db.select().from(users).where(eq(users.companyId, companyId));
  console.log('\n=== USERS ===');
  for (const u of allUsers) {
    console.log(`  "${u.name}" | ID: ${u.id} | Email: ${u.email}`);
  }

  process.exit(0);
}
main().catch(console.error);
