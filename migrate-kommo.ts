import fs from 'fs';
import * as dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';

// Load environment variables FIRST
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

// THEN import everything else dynamically or using require
const { db } = require('./src/lib/db');
const { users, kanbanBoards, kanbanLeads, contacts, conversations } = require('./src/lib/db/schema');
const { ilike, eq, and, or, inArray } = require('drizzle-orm');

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Empresa de Desenvolvimento Master

function normalizePhone(phone: any): string | null {
    if (!phone) return null;
    let str = String(phone).replace(/\D/g, '');
    if (str.length < 10) return null;
    if (!str.startsWith('55')) {
        str = '55' + str;
    }
    return str;
}

function matchUser(name: string, allUsers: any[]) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return allUsers.find(u => u.name && u.name.toLowerCase().includes(lower))?.id || null;
}

async function main() {
    console.log('Fetching users and boards from DB...');
    const allUsers = await db.select().from(users);
    const allBoards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, COMPANY_ID));
    
    const boardCache = new Map();
    const stageCache = new Map(); // boardId -> map of stage name -> stage id

    for (const board of allBoards) {
        boardCache.set(board.name.toUpperCase().trim(), board.id);
        const stages = typeof board.stages === 'string' ? JSON.parse(board.stages) : board.stages;
        const sMap = new Map();
        if (stages) {
            stages.forEach((s: any) => {
                if (s.name) sMap.set(s.name.toUpperCase().trim(), s.id)
            });
        }
        stageCache.set(board.id, sMap);
    }

    const files = [
        'kommo_export_leads_2026-05-25 (3).xlsx',
        'kommo_export_leads_2026-05-25 (4).xlsx',
        'kommo_export_leads_2026-05-25 (5).xlsx',
        'kommo_export_leads_2026-05-25 (6).xlsx'
    ];

    let totalRows = 0;
    let totalAssignments = 0;
    let totalNewLeads = 0;
    let totalAlreadyAssigned = 0;
    let totalAlreadyInFunnel = 0;
    let totalNotFound = 0;

    for (const filename of files) {
        const filePath = path.join(__dirname, 'Kommo', filename);
        console.log(`\nProcessing ${filePath}...`);
        
        if (!fs.existsSync(filePath)) {
            console.log(`File not found, skipping.`);
            continue;
        }

        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet) as any[];
        
        console.log(`Read ${rows.length} rows.`);

        for (const row of rows) {
            totalRows++;
            // The object keys are the header names
            const funnelName = row['Funil'] ? String(row['Funil']).trim() : null;
            const stageName = row['Etapa'] ? String(row['Etapa']).trim() : null;
            const responsibleUser = row['Usuário Responsável'] ? String(row['Usuário Responsável']).trim() : null;
            
            // Kommo might put phone in multiple places:
            const rawPhones = [
                row['Telefone comercial (contato)'],
                row['Tel. direto com. (contato)'],
                row['Celular (contato)'],
                row['Telefone residencial (contato)'],
                row['Outro telefone (contato)'],
                row['Nome do contato'] // as seen in previous run, sometimes it's placed here
            ];

            let phoneToUse: string | null = null;
            for (const p of rawPhones) {
                const norm = normalizePhone(p);
                if (norm) {
                    phoneToUse = norm;
                    break;
                }
            }

            if (!phoneToUse) {
                continue; // No phone, can't map to a contact
            }

            // 1. Find the contact in the database
            const foundContacts = await db.select().from(contacts).where(
                and(
                    eq(contacts.companyId, COMPANY_ID),
                    ilike(contacts.phone, `%${phoneToUse.slice(-8)}%`) // match the last 8 digits just to be safe
                )
            );

            if (foundContacts.length === 0) {
                totalNotFound++;
                continue;
            }

            // We take the first matched contact
            const contact = foundContacts[0];
            const contactId = contact.id;

            // 2. Resolve User
            const mappedUserId = matchUser(responsibleUser || '', allUsers);

            // 3. Resolve Board and Stage
            const boardId = funnelName ? boardCache.get(funnelName.toUpperCase()) : null;
            let targetStageId = null;
            let targetStageObj = null;
            
            if (boardId && stageName) {
                const sMap = stageCache.get(boardId);
                if (sMap && sMap.has(stageName.toUpperCase())) {
                    targetStageId = sMap.get(stageName.toUpperCase());
                    
                    // fetch full object from board to store in currentStage
                    const b = allBoards.find(x => x.id === boardId);
                    if (b) {
                        const stages = typeof b.stages === 'string' ? JSON.parse(b.stages) : b.stages;
                        targetStageObj = stages.find((s:any) => s.id === targetStageId);
                    }
                } else if (sMap) {
                    // Fallback to first stage if name doesn't match perfectly
                    const b = allBoards.find(x => x.id === boardId);
                    if (b) {
                        const stages = typeof b.stages === 'string' ? JSON.parse(b.stages) : b.stages;
                        if (stages && stages.length > 0) {
                            targetStageId = stages[0].id;
                            targetStageObj = stages[0];
                        }
                    }
                }
            }

            // --- A. Atribuição de Usuário na Tabela Conversations ---
            if (mappedUserId) {
                const convs = await db.select().from(conversations).where(eq(conversations.contactId, contactId));
                if (convs.length > 0) {
                    for (const conv of convs) {
                        if (!conv.assignedTo) {
                            await db.update(conversations)
                                .set({ assignedTo: mappedUserId, isRead: true })
                                .where(eq(conversations.id, conv.id));
                            totalAssignments++;
                        } else {
                            // If it's already assigned to someone else, we leave it as is
                            if (conv.assignedTo === mappedUserId) {
                                totalAlreadyAssigned++;
                            }
                        }
                    }
                }
            }

            // --- B. Multi Funil (Inserir Card) ---
            if (boardId && targetStageId) {
                const existingLead = await db.query.kanbanLeads.findFirst({
                    where: and(
                        eq(kanbanLeads.boardId, boardId),
                        eq(kanbanLeads.contactId, contactId)
                    )
                });

                if (!existingLead) {
                    await db.insert(kanbanLeads).values({
                        companyId: COMPANY_ID,
                        boardId: boardId,
                        stageId: targetStageId,
                        contactId: contactId,
                        title: contact.name || row['Nome do Lead'] || 'Lead',
                        currentStage: targetStageObj,
                        lastStageChangeAt: new Date(),
                    });
                    totalNewLeads++;
                } else {
                    // It's already in THIS funnel.
                    // Should we move it to the stage from the spreadsheet? 
                    // Let's just keep it where it is, or maybe update it if it's new.
                    // For now, doing nothing to not overwrite recent progress in the system.
                    totalAlreadyInFunnel++;
                }
            }
        }
    }

    console.log('\n--- Resumo Final ---');
    console.log(`Linhas lidas (Total): ${totalRows}`);
    console.log(`Contatos não encontrados no BD: ${totalNotFound}`);
    console.log(`Novas Atribuições de Conversas (Chats Liberados): ${totalAssignments}`);
    console.log(`Conversas que já estavam atribuídas corretamente: ${totalAlreadyAssigned}`);
    console.log(`Novos Cards criados no Kanban (Multi Funil): ${totalNewLeads}`);
    console.log(`Cards que já existiam no Kanban respectivo: ${totalAlreadyInFunnel}`);
    
    process.exit(0);
}

main().catch(console.error);
