
import { db } from '../lib/db';
import {
    companies, users, connections, contacts,
    automationRules, automationLogs, campaigns,
    messageTemplates, tags, contactLists,
    contactsToTags, contactsToContactLists,
    messages, conversations
} from '../lib/db/schema';
import { eq, ne, inArray, and } from 'drizzle-orm';

const SAFE_COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
const SAFE_USER_EMAIL = 'diegomaninhu@gmail.com';

async function main() {
    console.log('🚨 SYSTEM CLEANUP STARTED 🚨');
    console.log('='.repeat(60));
    console.log(`🛡️  SAFEGUARDING:`);
    console.log(`   Company ID: ${SAFE_COMPANY_ID}`);
    console.log(`   User: ${SAFE_USER_EMAIL}`);
    console.log('='.repeat(60));

    try {
        // 1. Identify companies to delete
        const companiesToDelete = await db.select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(ne(companies.id, SAFE_COMPANY_ID));

        if (companiesToDelete.length === 0) {
            console.log('✅ No companies to delete! System is clean.');
            process.exit(0);
        }

        console.log(`\n🗑️  Found ${companiesToDelete.length} companies to delete:`);
        companiesToDelete.forEach(c => console.log(`   - ${c.name} (${c.id})`));

        const companyIds = companiesToDelete.map(c => c.id);

        // 2. Delete related data explicitly (to ensure deep cleaning)
        console.log('\n🧹 Deleting related data...');

        // Users
        const deletedUsers = await db.delete(users)
            .where(inArray(users.companyId, companyIds))
            .returning({ id: users.id });
        console.log(`   - Deleted ${deletedUsers.length} users`);

        // Connections
        const deletedConnections = await db.delete(connections)
            .where(inArray(connections.companyId, companyIds))
            .returning({ id: connections.id });
        console.log(`   - Deleted ${deletedConnections.length} connections`);

        // Contacts (and their relations via cascades ideally, but explicit here for safety)
        const deletedContacts = await db.delete(contacts)
            .where(inArray(contacts.companyId, companyIds))
            .returning({ id: contacts.id });
        console.log(`   - Deleted ${deletedContacts.length} contacts`);

        // Campaigns
        const deletedCampaigns = await db.delete(campaigns)
            .where(inArray(campaigns.companyId, companyIds))
            .returning({ id: campaigns.id });
        console.log(`   - Deleted ${deletedCampaigns.length} campaigns`);

        // Automation Rules
        const deletedRules = await db.delete(automationRules)
            .where(inArray(automationRules.companyId, companyIds))
            .returning({ id: automationRules.id });
        console.log(`   - Deleted ${deletedRules.length} automation rules`);

        // 3. Finally, delete the companies
        console.log('\n🔥 Deleting companies...');
        const deletedCompanies = await db.delete(companies)
            .where(inArray(companies.id, companyIds))
            .returning({ id: companies.id });

        console.log(`   - Successfully deleted ${deletedCompanies.length} companies.`);

        console.log('\n✅ CLEANUP COMPLETE.');

    } catch (error) {
        console.error('❌ FATAL ERROR DURING CLEANUP:', error);
    }

    process.exit(0);
}

main();
