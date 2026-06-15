import fs from 'fs';
import Papa from 'papaparse';
import { db } from './src/lib/db';
import { contacts, kanbanLeads, conversations } from './src/lib/db/schema';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
const BOARD_ID = 'b7f872be-03db-4e3a-832c-f7c746aa14cc';
const STAGE_ID = '42011dc3-3868-4b22-ab6c-5896e8352249'; // Lead Novo
const USER_CAMILA_ID = 'b29b0719-242f-4294-9189-6c5fb89ede63';

// Helper function from the system logic
export function canonicalizeBrazilPhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 10) {
        let local = digits.substring(2);
        if (local.length === 11 && local[2] === '9') {
            return `55${local.substring(0, 2)}${local.substring(3)}`;
        }
        if (local.length === 10) {
            return `55${local}`;
        }
        return digits;
    }
    return digits;
}

export function getPhoneVariations(phone: string): string[] {
    let digits = phone.replace(/\D/g, '');
    const isBrazil = digits.startsWith('55');
    if (!isBrazil) return [digits];
    const withoutCountry = digits.substring(2);
    if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
        return [
            digits,
            `55${withoutCountry.substring(0, 2)}${withoutCountry.substring(3)}`
        ];
    } else if (withoutCountry.length === 10) {
        return [
            digits,
            `55${withoutCountry.substring(0, 2)}9${withoutCountry.substring(2)}`
        ];
    }
    return [digits];
}

async function main() {
    const csvFile = fs.readFileSync('C:\\Users\\Administrator\\Desktop\\masteria\\GCR\\20260615-antonio-3gcr-inside-sales-j4e8uuasav0atchcrsukzea9x.csv', 'utf8');

    const result = Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true
    });

    const rows = result.data as any[];
    console.log(`Parsed ${rows.length} rows from CSV`);

    let createdContacts = 0;
    let createdLeads = 0;
    let assignedConversations = 0;

    for (const row of rows) {
        const rawPhone = row['Qual seu Whatsapp?'];
        const name = row['Qual seu nome?'] || 'Sem Nome';
        const email = row['Qual o seu melhor e-mail?'];

        if (!rawPhone) continue;
        
        // Remove spaces and +
        const digitsPhone = rawPhone.replace(/\D/g, '');
        const phoneVariations = getPhoneVariations(digitsPhone);
        const canonPhone = digitsPhone; // We insert as they wrote or as canonicalize, we will use canonicalize
        const finalPhoneToInsert = phoneVariations[0] || digitsPhone; // standard approach

        const customFields = {
            "Cargo": row['Qual o seu cargo na empresa?'] || "",
            "Instagram": row['Qual o @ do seu Instagram?'] || "",
            "N° de Colaboradores": row['Quantos colaboradores vocA tem na sua empresa atualmente?'] || row['Quantos colaboradores você tem na sua empresa atualmente?'] || "",
            "Faturamento": row['E qual o faturamento mAcdio mensal da sua empresa?'] || row['E qual o faturamento médio mensal da sua empresa?'] || "",
            "Segmento/Nicho": row['Qual Ac o seu nicho/Area de atuaA Ao?'] || row['Qual é o seu nicho/área de atuação?'] || "",
            "Principal Objetivo": row['Qual o seu principal objetivo no Evento GestAo com Resultado?'] || row['Qual o seu principal objetivo no Evento Gestão com Resultado?'] || "",
            "Investimento": row['O Evento GestAo com Resultado Ac um evento presencial que acontece no Alphaville SP, valor do Investimento Ac a partir R$ 2500, qual opA Ao vocA prefere?'] || row['O Evento Gestão com Resultado é um evento presencial que acontece no Alphaville SP, valor do Investimento é a partir R$ 1497, qual opção você prefere?'] || "",
            "UTM Source": row['utm_source'] || "",
            "UTM Medium": row['utm_medium'] || "",
            "UTM Campaing": row['utm_campaign'] || "",
            "UTM Content": row['utm_content'] || "",
            "utm_source": row['utm_source'] || "",
            "utm_medium": row['utm_medium'] || "",
            "utm_campaign": row['utm_campaign'] || "",
            "utm_content": row['utm_content'] || "",
            "Qual seu nome?": name,
            "Qual seu Whatsapp?": rawPhone,
            "Qual o seu melhor e-mail?": email || "",
            "Qual o seu cargo na empresa?": row['Qual o seu cargo na empresa?'] || "",
            "Qual o @ do seu Instagram?": row['Qual o @ do seu Instagram?'] || "",
            "Quantos colaboradores você tem na sua empresa atualmente?": row['Quantos colaboradores vocA tem na sua empresa atualmente?'] || row['Quantos colaboradores você tem na sua empresa atualmente?'] || "",
            "E qual o faturamento médio mensal da sua empresa?": row['E qual o faturamento mAcdio mensal da sua empresa?'] || row['E qual o faturamento médio mensal da sua empresa?'] || "",
            "Qual é o seu nicho/área de atuação?": row['Qual Ac o seu nicho/Area de atuaA Ao?'] || row['Qual é o seu nicho/área de atuação?'] || "",
            "Qual o seu principal objetivo no Evento Gestão com Resultado?": row['Qual o seu principal objetivo no Evento GestAo com Resultado?'] || row['Qual o seu principal objetivo no Evento Gestão com Resultado?'] || "",
            "O Evento Gestão com Resultado é um evento presencial que acontece no Alphaville SP, valor do Investimento é a partir R$ 1497, qual opção você prefere?": row['O Evento GestAo com Resultado Ac um evento presencial que acontece no Alphaville SP, valor do Investimento Ac a partir R$ 2500, qual opA Ao vocA prefere?'] || ""
        };

        // Encontrar Contato
        let contact = await db.query.contacts.findFirst({
            where: and(
                eq(contacts.companyId, COMPANY_ID),
                inArray(contacts.phone, phoneVariations)
            )
        });

        if (!contact) {
            console.log(`[INFO] Criando contato: ${name} (${finalPhoneToInsert})`);
            const [newContact] = await db.insert(contacts).values({
                companyId: COMPANY_ID,
                name: name,
                phone: finalPhoneToInsert,
                email: email,
                customFields: customFields,
                status: 'ACTIVE'
            }).returning();
            contact = newContact;
            createdContacts++;
        } else {
            console.log(`[INFO] Contato já existente, atualizando customFields: ${contact.name} (${contact.phone})`);
            
            // Fazer um merge dos campos existentes com os do CSV (não sobrescrevendo com vazio)
            let updatedFields = { ...(contact.customFields as any) };
            for(let key in customFields) {
                if((customFields as any)[key]) {
                    updatedFields[key] = (customFields as any)[key];
                }
            }
            
            await db.update(contacts)
                .set({ customFields: updatedFields })
                .where(eq(contacts.id, contact.id));
        }

        // Criar ou atualizar Lead no Kanban
        let lead = await db.query.kanbanLeads.findFirst({
            where: and(
                eq(kanbanLeads.companyId, COMPANY_ID),
                eq(kanbanLeads.boardId, BOARD_ID),
                eq(kanbanLeads.contactId, contact.id)
            )
        });

        if (!lead) {
            console.log(`[INFO] Adicionando ao Kanban (Lead Novo): ${name}`);
            await db.insert(kanbanLeads).values({
                companyId: COMPANY_ID,
                boardId: BOARD_ID,
                stageId: STAGE_ID,
                contactId: contact.id,
                title: name,
                status: 'ACTIVE'
            });
            createdLeads++;
        }

        // Atribuir conversa para a Camila Brandão
        let conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.companyId, COMPANY_ID),
                eq(conversations.contactId, contact.id)
            )
        });

        if (!conversation) {
            console.log(`[INFO] Criando nova conversa e atribuindo à Camila Brandão`);
            await db.insert(conversations).values({
                companyId: COMPANY_ID,
                contactId: contact.id,
                assignedTo: USER_CAMILA_ID,
                status: 'NEW',
                aiActive: false // Já que é da Camila agora
            });
            assignedConversations++;
        } else if (conversation.assignedTo !== USER_CAMILA_ID) {
            console.log(`[INFO] Atualizando conversa e atribuindo à Camila Brandão`);
            await db.update(conversations)
                .set({ 
                    assignedTo: USER_CAMILA_ID,
                    status: (conversation.status === 'ARCHIVED' || conversation.status === 'CLOSED') ? 'IN_PROGRESS' : conversation.status,
                    aiActive: false
                })
                .where(eq(conversations.id, conversation.id));
            assignedConversations++;
        }
    }

    console.log('\n--- RESUMO ---');
    console.log(`Contatos Criados: ${createdContacts}`);
    console.log(`Leads Inseridos no Kanban: ${createdLeads}`);
    console.log(`Conversas Atribuídas/Criadas: ${assignedConversations}`);
}

main().catch(console.error).finally(() => process.exit(0));
