
import { db } from '../lib/db';
import { companies, users, connections } from '../lib/db/schema';
import { count, eq, desc } from 'drizzle-orm';

async function main() {
    console.log('='.repeat(60));
    console.log('🔍 SYSTEM AUDIT 🔍');
    console.log('='.repeat(60));

    try {
        // 1. Audit Companies
        console.log('\n🏢 COMPANIES OVERVIEW:');
        const allCompanies = await db.select().from(companies).orderBy(desc(companies.createdAt));
        console.log(`Total Companies: ${allCompanies.length}`);

        for (const company of allCompanies) {
            const userCount = await db.select({ count: count() })
                .from(users)
                .where(eq(users.companyId, company.id));

            console.log(`   - [${company.createdAt?.toISOString().split('T')[0]}] ${company.name} (${company.id})`);
            console.log(`     Plan: ${company.aiModel || 'N/A'} | Users: ${userCount[0].count}`);
        }

        // 2. Audit Specific User
        console.log('\n👤 SUPER ADMIN AUDIT (diegomaninhu@gmail.com):');
        const superAdmin = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            companyName: companies.name,
            companyId: companies.id
        })
            .from(users)
            .leftJoin(companies, eq(users.companyId, companies.id))
            .where(eq(users.email, 'diegomaninhu@gmail.com'));

        if (superAdmin.length > 0) {
            console.log(JSON.stringify(superAdmin[0], null, 2));
        } else {
            console.log('   ❌ User not found!');
        }

        // 3. Audit Connections
        console.log('\n🔌 CONNECTIONS STATUS:');
        const allConnections = await db.select({
            id: connections.id,
            name: connections.config_name,
            type: connections.connectionType,
            status: connections.status,
            company: companies.name
        })
            .from(connections)
            .leftJoin(companies, eq(connections.companyId, companies.id));

        console.table(allConnections.map(c => ({
            Type: c.type,
            Name: c.name,
            Status: c.status,
            Company: c.company || 'Unknown'
        })));


    } catch (error) {
        console.error('❌ FATAL ERROR DURING AUDIT:', error);
    }

    process.exit(0);
}

main();
