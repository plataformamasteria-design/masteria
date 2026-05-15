import { db } from './src/lib/db';
import { users, companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        const userId = 'f400e57a-3884-43cf-8277-4f56874f5ad6';
        const results = await db
          .select({
            user: users,
            company: companies
          })
          .from(users)
          .leftJoin(companies, eq(users.companyId, companies.id))
          .where(eq(users.id, userId))
          .limit(1);
          
        console.log("Success:", !!results[0]);
    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
