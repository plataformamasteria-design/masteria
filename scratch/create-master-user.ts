import { db } from '@/lib/db';
import { companies, users } from '@/lib/db/schema';
import { ilike } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

async function createUser() {
    try {
        console.log('Searching for company "Master"...');
        const foundCompanies = await db.select().from(companies).where(ilike(companies.name, '%Master%'));
        
        if (foundCompanies.length === 0) {
            console.log('Company not found.');
            process.exit(1);
        }

        console.log('Found companies:', foundCompanies);

        const targetCompany = foundCompanies[0];
        console.log('Using company ID:', targetCompany.id);

        const email = 'viniciusandreoli.af@gmail.com';
        const passwordHash = await hash('Ab12345678', 10);

        console.log(`Creating user ${email}...`);

        const [newUser] = await db.insert(users).values({
            name: 'Vinicius Andreoli',
            email: email,
            password: passwordHash,
            firebaseUid: `native_${randomUUID()}`,
            role: 'admin',
            companyId: targetCompany.id,
            emailVerified: new Date(),
        }).returning();

        console.log('User created successfully:', newUser);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

createUser();
