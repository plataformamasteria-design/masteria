import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { kanbanBoards, kanbanLeads, conversations, users, usersToTeams } = require('./src/lib/db/schema');
const { eq, and, isNull, inArray } = require('drizzle-orm');

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
const TEAM_ID = '44c60a5d-5fe4-45cc-9ebc-fd3dd4652d7d'; // Seção de Vendas

async function main() {
    console.log('Buscando equipe de vendas...');
    const salesTeamUsers = await db.select({ userId: usersToTeams.userId })
        .from(usersToTeams)
        .where(eq(usersToTeams.teamId, TEAM_ID));
    
    let activeSalesUsers = [];
    for (const tu of salesTeamUsers) {
        const u = await db.select().from(users).where(eq(users.id, tu.userId));
        if (u[0]) {
            activeSalesUsers.push(u[0].id);
        }
    }

    if (activeSalesUsers.length === 0) {
        console.log('Nenhum usuário ativo na equipe de vendas!');
        process.exit(1);
    }

    console.log(`Encontrados ${activeSalesUsers.length} vendedores ativos.`);

    console.log('\nBuscando primeira etapa de todos os funis...');
    const boards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, COMPANY_ID));
    
    const firstStageIds = [];
    for (const b of boards) {
        if (b.stages) {
            const stgs = typeof b.stages === 'string' ? JSON.parse(b.stages) : b.stages;
            if (stgs && stgs.length > 0) {
                firstStageIds.push(stgs[0].id);
            }
        }
    }

    if (firstStageIds.length === 0) {
        console.log('Nenhuma etapa encontrada!');
        process.exit(1);
    }
    
    console.log(`Monitorando ${firstStageIds.length} etapas (1ª etapa de cada funil).`);

    console.log('\nBuscando leads nestas etapas...');
    const leads = await db.select().from(kanbanLeads)
        .where(
            and(
                eq(kanbanLeads.companyId, COMPANY_ID),
                inArray(kanbanLeads.stageId, firstStageIds)
            )
        );
    
    console.log(`Total de leads encontrados na 1ª etapa: ${leads.length}`);

    if (leads.length === 0) {
        console.log('Nenhum lead encontrado.');
        process.exit(0);
    }

    const contactIds = leads.map((l: any) => l.contactId).filter(Boolean);

    // Encontrar conversas sem atribuição para esses contatos
    console.log('\nBuscando conversas sem atribuição (órfãs)...');
    
    // Chunk array to avoid SQL param limits
    const chunkSize = 1000;
    let unassignedConvos = [];
    for (let i = 0; i < contactIds.length; i += chunkSize) {
        const chunk = contactIds.slice(i, i + chunkSize);
        const convos = await db.select().from(conversations).where(
            and(
                inArray(conversations.contactId, chunk),
                isNull(conversations.assignedTo)
            )
        );
        unassignedConvos.push(...convos);
    }

    console.log(`Total de conversas órfãs encontradas: ${unassignedConvos.length}`);

    if (unassignedConvos.length === 0) {
        console.log('Todos os leads já possuem atribuição!');
        process.exit(0);
    }

    console.log('\nDistribuindo leads (Round-Robin)...');
    let rrIndex = 0;
    let assignmentCount = 0;

    for (const convo of unassignedConvos) {
        const assignedUserId = activeSalesUsers[rrIndex % activeSalesUsers.length];
        
        await db.update(conversations)
            .set({ 
                assignedTo: assignedUserId,
                teamId: TEAM_ID 
            })
            .where(eq(conversations.id, convo.id));
        
        assignmentCount++;
        rrIndex++;
    }

    console.log('\n==============================');
    console.log('====== RESUMO ATRIBUIÇÃO =====');
    console.log('==============================');
    console.log(`Leads órfãos distribuídos: ${assignmentCount}`);
    console.log(`Vendedores utilizados: ${activeSalesUsers.length}`);
    console.log(`Média por vendedor: ${(assignmentCount / activeSalesUsers.length).toFixed(1)} leads`);
    console.log('✅ Operação concluída com sucesso!');

    process.exit(0);
}

main().catch(console.error);
