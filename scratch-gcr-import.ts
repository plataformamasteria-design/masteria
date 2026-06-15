import { db } from './src/lib/db';
import { companies, users, kanbanBoards, kanbanLeads, contacts } from './src/lib/db/schema';
import { ilike, eq, like } from 'drizzle-orm';

async function main() {
    console.log("--- COMPANIES ---");
    const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
    console.log(allCompanies.filter(c => c.name.toLowerCase().includes('master') || c.name.toLowerCase().includes('desenvolvimento')));

    console.log("\n--- USERS (Camila Brandão) ---");
    const camilaUsers = await db.select({ id: users.id, name: users.name, companyId: users.companyId }).from(users).where(ilike(users.name, '%camila%'));
    console.log(camilaUsers);

    console.log("\n--- KANBAN BOARDS (GCR) ---");
    const boards = await db.select({ id: kanbanBoards.id, name: kanbanBoards.name, companyId: kanbanBoards.companyId, stages: kanbanBoards.stages }).from(kanbanBoards).where(ilike(kanbanBoards.name, '%gcr%'));
    for (const b of boards) {
        console.log(`Board: ${b.name} (${b.id}) - Company: ${b.companyId}`);
        console.log(`Stages:`, b.stages.map((s: any) => `${s.title} (${s.id})`).join(', '));
    }
}

main().catch(console.error).finally(() => process.exit(0));
