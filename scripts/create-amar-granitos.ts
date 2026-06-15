import { db } from '../src/lib/db';
import { users, companies } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
    const companyName = "Amar Granitos";
    const email = "amargranitos@amargranitos.com";
    const password = "*Ma64187944";

    const existingCompany = await db.select().from(companies).where(eq(companies.name, companyName));
    let companyId;
    if (existingCompany.length > 0) {
        console.log("Company already exists");
        companyId = existingCompany[0].id;
    } else {
        console.log("Creating company...");
        const [newCompany] = await db.insert(companies).values({
            name: companyName,
        }).returning();
        companyId = newCompany.id;
        console.log("Company created successfully with ID: " + companyId);
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existingUser.length > 0) {
        console.log("User already exists");
        return;
    }

    console.log("Creating user...");
    const passwordHash = await hash(password, 10);

    await db.insert(users).values({
        name: "Amar Granitos",
        email: email.toLowerCase(),
        password: passwordHash,
        role: "admin",
        companyId: companyId,
        firebaseUid: `native_${randomUUID()}`,
        emailVerified: new Date(),
    });

    console.log("User created successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
