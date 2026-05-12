import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from './src/lib/db/index.js';
import { users, companies } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
    const email = 'megapochete@gmail.com';
    const result = await db.select({
        userEmail: users.email,
        companyName: companies.name,
        companyId: users.companyId,
        role: users.role
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.email, email));

    if (result.length > 0) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log('Email nao encontrado no banco de dados.');
    }
    process.exit(0);
}
main().catch(console.error);
