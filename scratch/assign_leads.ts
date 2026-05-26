require('dotenv').config({ path: '.env.local' });
import { eq, gte, and, sql } from 'drizzle-orm';

async function main() {
    const { db } = await import('../src/lib/db');
    const { companies, kanbanLeads, conversations, users, teams, usersToTeams } = await import('../src/lib/db/schema');
    
    console.log("=== INSPECTING LEADS AND TEAMS ===");

    // Find company Empresa de Desenvolvimento Master
    const allComps = await db.select().from(companies).where(sql`${companies.name} ILIKE '%Empresa de Desenvolvimento Master%'`);
    const company = allComps[0];
    if (!company) {
        console.log("Company not found!");
        process.exit(1);
    }
    console.log(`Company: ${company.name} (${company.id})`);

    // Find "Seção de vendas" team
    const allTeams = await db.select().from(teams).where(eq(teams.companyId, company.id));
    const targetTeam = allTeams.find((t: any) => t.name.toLowerCase().includes('seção de vendas') || t.name.toLowerCase().includes('secao de vendas'));
    if (!targetTeam) {
        console.log("Team Seção de vendas not found!");
        console.log("Teams available:");
        allTeams.forEach((t: any) => console.log(` - ${t.name} (${t.id})`));
        process.exit(1);
    }
    console.log(`Team: ${targetTeam.name} (${targetTeam.id})`);

    // Get users in team
    const teamUsers = await db.select({ id: users.id, name: users.name })
        .from(users)
        .innerJoin(usersToTeams, eq(users.id, usersToTeams.userId))
        .where(eq(usersToTeams.teamId, targetTeam.id));
    
    console.log(`\nTeam Users (${teamUsers.length}):`);
    for (const u of teamUsers) {
        console.log(` - ${u.name} (${u.id})`);
    }

    const { desc } = await import('drizzle-orm');
    const { contacts } = await import('../src/lib/db/schema');
    const recentContacts = await db.select().from(contacts).where(
        eq(contacts.companyId, company.id)
    ).orderBy(desc(contacts.createdAt)).limit(10);
    console.log(`\nMost recent 10 contacts:`);
    recentContacts.forEach((c: any) => console.log(` - ${c.name || c.phone} (Created: ${c.createdAt})`));
    
    // Process all leads from today (since midnight Brazil time)
    const brazilMidnight = new Date();
    brazilMidnight.setUTCHours(3, 0, 0, 0); // 00:00 in BRT is 03:00 UTC
    if (new Date().getUTCHours() < 3) {
        brazilMidnight.setUTCDate(brazilMidnight.getUTCDate() - 1);
    }
    
    const todayLeads = await db.select().from(contacts).where(
        and(
            eq(contacts.companyId, company.id),
            gte(contacts.createdAt, brazilMidnight)
        )
    );
    console.log(`\nContacts created since ${brazilMidnight.toISOString()}: ${todayLeads.length}`);

    // Check how many have unassigned conversations (or no conversations)
    let unassignedLeads = [];
    for (const lead of todayLeads) {
        const convs = await db.select().from(conversations).where(and(
            eq(conversations.contactId, lead.id),
            eq(conversations.companyId, company.id)
        ));
        
        const hasAssigned = convs.some((c: any) => c.assignedTo !== null);
        if (!hasAssigned) {
            unassignedLeads.push({ lead, convs });
        }
    }
    
    console.log(`Leads with NO agent assigned: ${unassignedLeads.length}`);
    
    // Now distribute them randomly
    let idx = 0;
    for (const { lead, convs } of unassignedLeads) {
        // randomly pick a user
        const randomUser = teamUsers[Math.floor(Math.random() * teamUsers.length)];
        
        console.log(`Assigning lead ${lead.id} (${lead.title}) to ${randomUser.name}`);
        
        if (convs.length > 0) {
            // Update existing
            for (const c of convs) {
                await db.update(conversations)
                    .set({ assignedTo: randomUser.id, teamId: targetTeam.id })
                    .where(eq(conversations.id, c.id));
            }
        } else {
            // Create empty conv
            await db.insert(conversations).values({
                companyId: company.id,
                contactId: lead.id,
                status: 'NEW',
                assignedTo: randomUser.id,
                teamId: targetTeam.id,
                aiActive: false
            });
        }
        idx++;
    }
    console.log(`\nSuccessfully assigned ${idx} leads!`);
    process.exit(0);
}

main().catch(console.error);
