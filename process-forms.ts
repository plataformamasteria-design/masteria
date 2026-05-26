import fs from 'fs';
import * as dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { users, kanbanBoards, kanbanLeads, contacts, conversations, usersToTeams } = require('./src/lib/db/schema');
const { ilike, eq, and, or } = require('drizzle-orm');
const { v4: uuidv4 } = require('uuid');

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Empresa de Desenvolvimento Master
const TEAM_ID = '44c60a5d-5fe4-45cc-9ebc-fd3dd4652d7d'; // Seção de vendas

const fileMap = [
    {
        file: '20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx',
        boardId: 'b7f872be-03db-4e3a-832c-f7c746aa14cc' // FUNIL EVENTO GCR
    },
    {
        file: '20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx',
        boardId: '6bccc06c-4eb2-41e1-9c9d-5a133c267418' // FUNIL MENTORIA
    },
    {
        file: '20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx',
        boardId: 'b8856169-d5ee-40ea-a876-20c8b46234cf' // FUNIL EDN [ATUAL]
    },
    {
        file: '20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx',
        boardId: '72e90627-1f9c-493e-a243-71ef668c021a' // FUNIL ENCONTRO DE CASAIS
    }
];

function normalizePhone(phone: any): string | null {
    if (!phone) return null;
    let str = String(phone).replace(/\D/g, '');
    if (str.length < 10) return null;
    if (!str.startsWith('55')) {
        str = '55' + str;
    }
    return str;
}

async function main() {
    console.log('Buscando membros da Seção de Vendas...');
    const members = await db.select({ userId: usersToTeams.userId }).from(usersToTeams).where(eq(usersToTeams.teamId, TEAM_ID));
    const memberIds = members.map((m: any) => m.userId);
    
    if (memberIds.length === 0) {
        console.error('Nenhum membro encontrado na equipe Seção de Vendas.');
        process.exit(1);
    }
    
    console.log(`Encontrados ${memberIds.length} membros.`);

    const allBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, COMPANY_ID));
    
    let stats = {
        totalRows: 0,
        alreadyInFunnel: 0,
        newLeadsCreated: 0,
        newContactsCreated: 0,
        conversationsUpdated: 0,
        conversationsCreated: 0,
        noPhone: 0
    };

    for (const mapping of fileMap) {
        const filePath = path.join(__dirname, 'FORM FUNIL', mapping.file);
        console.log(`\nProcessando ${mapping.file}...`);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Arquivo não encontrado: ${filePath}`);
            continue;
        }

        const board = allBoards.find((b: any) => b.id === mapping.boardId);
        if (!board) {
            console.log(`❌ Funil não encontrado no DB para ID: ${mapping.boardId}`);
            continue;
        }
        
        const stages = typeof board.stages === 'string' ? JSON.parse(board.stages) : board.stages;
        if (!stages || stages.length === 0) {
            console.log(`❌ Funil ${board.name} não possui etapas.`);
            continue;
        }
        const firstStage = stages[0];

        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet) as any[];
        
        console.log(`Total de linhas: ${rows.length} | Funil Destino: ${board.name}`);

        for (const row of rows) {
            stats.totalRows++;
            
            const rawPhone = row['Qual seu Whatsapp?'] || row['Descreva um número que podemos entrar em contato'] || row['Telefone'];
            const phoneToUse = normalizePhone(rawPhone);
            
            if (!phoneToUse) {
                stats.noPhone++;
                continue;
            }

            const rawName = row['Qual seu nome?'] || row['Qual o seu nome completo?'] || row['Qual seu nome completo?'] || 'Lead sem nome';

            // 1. Encontrar o Contato
            const foundContacts = await db.select().from(contacts).where(
                and(
                    eq(contacts.companyId, COMPANY_ID),
                    ilike(contacts.phone, `%${phoneToUse.slice(-8)}%`)
                )
            );

            let contactId;
            
            if (foundContacts.length === 0) {
                // Criar contato se não existir
                const inserted = await db.insert(contacts).values({
                    companyId: COMPANY_ID,
                    name: rawName,
                    phone: phoneToUse,
                    contactSource: 'import',
                    optIn: true,
                }).returning();
                contactId = inserted[0].id;
                stats.newContactsCreated++;
            } else {
                contactId = foundContacts[0].id;
            }

            // 2. Verificar no Funil
            const existingLead = await db.query.kanbanLeads.findFirst({
                where: and(
                    eq(kanbanLeads.boardId, board.id),
                    eq(kanbanLeads.contactId, contactId)
                )
            });

            if (existingLead) {
                // Já está no funil, ignora
                stats.alreadyInFunnel++;
            } else {
                // Adiciona na primeira etapa
                await db.insert(kanbanLeads).values({
                    companyId: COMPANY_ID,
                    boardId: board.id,
                    stageId: firstStage.id,
                    contactId: contactId,
                    title: rawName,
                    currentStage: firstStage,
                    lastStageChangeAt: new Date(),
                });
                
                stats.newLeadsCreated++;

                // 3. Atribuição Aleatória
                const randomUserId = memberIds[Math.floor(Math.random() * memberIds.length)];
                
                const convs = await db.select().from(conversations).where(eq(conversations.contactId, contactId));
                
                if (convs.length > 0) {
                    const conv = convs[0]; // Pega a primeira
                    await db.update(conversations)
                        .set({ assignedTo: randomUserId, isRead: true })
                        .where(eq(conversations.id, conv.id));
                    stats.conversationsUpdated++;
                } else {
                    // Cria uma conversa vazia para o contato
                    await db.insert(conversations).values({
                        companyId: COMPANY_ID,
                        contactId: contactId,
                        status: 'NEW',
                        assignedTo: randomUserId,
                        unreadCount: 0,
                    });
                    stats.conversationsCreated++;
                }
            }
        }
    }

    console.log('\n==============================');
    console.log('====== RESUMO DA OPERAÇÃO ====');
    console.log('==============================');
    console.log(`Linhas lidas no total: ${stats.totalRows}`);
    console.log(`Ignorados por falta de telefone: ${stats.noPhone}`);
    console.log(`Ignorados (já existiam no funil): ${stats.alreadyInFunnel}`);
    console.log(`\nNOVOS LEADS INSERIDOS NOS FUNIS: ${stats.newLeadsCreated}`);
    console.log(`  -> Novos Contatos Criados: ${stats.newContactsCreated}`);
    console.log(`  -> Conversas Atualizadas (Atribuídas): ${stats.conversationsUpdated}`);
    console.log(`  -> Novas Conversas Criadas: ${stats.conversationsCreated}`);
    
    process.exit(0);
}

main().catch(console.error);
