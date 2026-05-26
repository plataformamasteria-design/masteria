require('dotenv').config({ path: '.env.local' });
import { eq, gte, and, sql, isNull } from 'drizzle-orm';

async function main() {
    const { db } = await import('../src/lib/db');
    const { companies, contacts, conversations, kanbanLeads, kanbanBoards, users, teams, usersToTeams } = await import('../src/lib/db/schema');
    
    console.log("=== UNDOING PREVIOUS AND REDOING ASSIGNMENTS ===");

    // Find company Empresa de Desenvolvimento Master
    const allComps = await db.select().from(companies).where(sql`${companies.name} ILIKE '%Empresa de Desenvolvimento Master%'`);
    const company = allComps[0];
    if (!company) {
        console.log("Company not found!");
        process.exit(1);
    }

    const allTeams = await db.select().from(teams).where(eq(teams.companyId, company.id));
    const targetTeam = allTeams.find((t: any) => t.name.toLowerCase().includes('seção de vendas') || t.name.toLowerCase().includes('secao de vendas'));
    if (!targetTeam) {
        console.log("Team Seção de vendas not found!");
        process.exit(1);
    }
    
    const teamUsers = await db.select({ id: users.id, name: users.name })
        .from(users)
        .innerJoin(usersToTeams, eq(users.id, usersToTeams.userId))
        .where(eq(usersToTeams.teamId, targetTeam.id));

    // ---- 1. UNDO TODAY'S ASSIGNMENTS ----
    const brazilMidnight = new Date();
    brazilMidnight.setUTCHours(3, 0, 0, 0);
    if (new Date().getUTCHours() < 3) {
        brazilMidnight.setUTCDate(brazilMidnight.getUTCDate() - 1);
    }
    
    const todayContacts = await db.select().from(contacts).where(
        and(
            eq(contacts.companyId, company.id),
            gte(contacts.createdAt, brazilMidnight)
        )
    );
    
    const todayContactIds = todayContacts.map(c => c.id);
    let undoneCount = 0;
    
    // For all conversations of today's contacts that are assigned to our target team, we clear them
    // Wait, let's just clear ALL of them that belong to these contacts AND are assigned to this team
    if (todayContactIds.length > 0) {
        for (const cid of todayContactIds) {
            const convsToClear = await db.select().from(conversations).where(and(
                eq(conversations.contactId, cid),
                eq(conversations.companyId, company.id),
                eq(conversations.teamId, targetTeam.id)
            ));
            
            for (const c of convsToClear) {
                await db.update(conversations)
                    .set({ assignedTo: null, teamId: null })
                    .where(eq(conversations.id, c.id));
                undoneCount++;
            }
        }
    }
    console.log(`Undone ${undoneCount} conversation assignments from today.`);

    // ---- 2. REDO CORRECTLY ----
    // Leads that arrived since 19/05/2026 AND are in "Lead Novo" stage
    const startDate = new Date('2026-05-19T03:00:00.000Z'); // May 19 midnight BRT

    // Find Kanban Leads in "Lead Novo" stage
    const recentLeads = await db.select().from(kanbanLeads).where(
        and(
            eq(kanbanLeads.companyId, company.id),
            gte(kanbanLeads.createdAt, startDate)
        )
    );
    
    // Filter to those whose currentStage is "Lead Novo" (either currentStage.name is Lead Novo, or stageId maps to it)
    let leadNovoLeads = [];
    const stageNames = new Set();
    for (const lead of recentLeads) {
        const stage: any = lead.currentStage;
        if (stage) {
            const sName = stage.name || stage.title || '';
            stageNames.add(sName);
            if (sName.toLowerCase() === 'lead novo') {
                leadNovoLeads.push(lead);
            }
        }
    }
    console.log("Available stage names: ", Array.from(stageNames).join(', '));
    console.log(`\nFound ${leadNovoLeads.length} leads in 'Lead Novo' stage since 19/05/26.`);

    // Filter to those that DO NOT have an assigned agent
    let unassignedLeads = [];
    for (const lead of leadNovoLeads) {
        const convs = await db.select().from(conversations).where(and(
            eq(conversations.contactId, lead.contactId),
            eq(conversations.companyId, company.id)
        ));
        
        const hasAssigned = convs.some((c: any) => c.assignedTo !== null);
        if (!hasAssigned) {
            unassignedLeads.push({ lead, convs });
        }
    }
    console.log(`Of those, ${unassignedLeads.length} currently have NO agent assigned.`);

    let assignedCount = 0;
    for (const { lead, convs } of unassignedLeads) {
        const randomUser = teamUsers[Math.floor(Math.random() * teamUsers.length)];
        
        if (convs.length > 0) {
            for (const c of convs) {
                await db.update(conversations)
                    .set({ assignedTo: randomUser.id, teamId: targetTeam.id })
                    .where(eq(conversations.id, c.id));
            }
        } else {
            await db.insert(conversations).values({
                companyId: company.id,
                contactId: lead.contactId,
                status: 'NEW',
                assignedTo: randomUser.id,
                teamId: targetTeam.id,
                aiActive: false
            });
        }
        assignedCount++;
    }

    console.log(`Successfully assigned ${assignedCount} leads from 'Lead Novo' since May 19th!`);
    process.exit(0);
}

main().catch(console.error);
