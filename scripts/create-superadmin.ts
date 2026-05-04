import { db } from '../src/lib/db';
import { users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import "dotenv/config";

async function main() {
    const email = "Superadmin@admin.com";
    const password = "DiegomaninhuMasterIA2025!";

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existing.length > 0) {
        console.log("Superadmin already exists");
        return;
    }

    console.log("Creating superadmin user...");
    const passwordHash = await hash(password, 10);

    await db.insert(users).values({
        name: "Superadmin",
        email: email.toLowerCase(),
        password: passwordHash,
        role: "superadmin",
        firebaseUid: `native_superadmin_${randomUUID()}`,
        emailVerified: new Date(),
    });

    console.log("Superadmin user created successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
