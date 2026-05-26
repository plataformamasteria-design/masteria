import fs from 'fs';
import * as dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { contacts, kanbanLeads, conversations } = require('./src/lib/db/schema');
const { ilike, eq, and } = require('drizzle-orm');

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

const formFiles = [
    { dir: 'FORM FUNIL', file: '20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx' },
    { dir: 'FORM FUNIL', file: '20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx' },
    { dir: 'FORM FUNIL', file: '20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx' },
    { dir: 'FORM FUNIL', file: '20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx' }
];

const kommoFiles = [
    { dir: 'Kommo', file: 'kommo_export_leads_2026-05-25 (3).xlsx' },
    { dir: 'Kommo', file: 'kommo_export_leads_2026-05-25 (4).xlsx' },
    { dir: 'Kommo', file: 'kommo_export_leads_2026-05-25 (5).xlsx' },
    { dir: 'Kommo', file: 'kommo_export_leads_2026-05-25 (6).xlsx' }
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

function parseDateStr(val: any): Date | null {
    if (!val) return null;
    const str = String(val).trim();
    // format 2026-05-01 11:16:07
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
        return new Date(str.replace(' ', 'T') + '-03:00'); 
    }
    // format 25.05.2026 12:21:44
    if (/^\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2}$/.test(str)) {
        const [datePart, timePart] = str.split(' ');
        const [day, month, year] = datePart.split('.');
        return new Date(`${year}-${month}-${day}T${timePart}-03:00`);
    }
    // try default parsing
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
}

async function main() {
    let stats = {
        totalRows: 0,
        noPhone: 0,
        noDate: 0,
        contactNotFound: 0,
        contactsUpdated: 0,
        leadsUpdated: 0,
        conversationsUpdated: 0
    };

    const allFiles = [...formFiles, ...kommoFiles];

    for (const mapping of allFiles) {
        const filePath = path.join(__dirname, mapping.dir, mapping.file);
        console.log(`\nProcessando datas de ${mapping.file}...`);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Arquivo não encontrado: ${filePath}`);
            continue;
        }

        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, any>[];
        
        console.log(`Total de linhas: ${rows.length}`);

        for (const row of rows) {
            stats.totalRows++;
            
            const rawPhone = row['Qual seu Whatsapp?'] || row['Descreva um número que podemos entrar em contato'] || row['Telefone comercial (contato)'] || row['Tel. direto com. (contato)'] || row['Celular (contato)'] || row['Nome do contato'];
            const phoneToUse = normalizePhone(rawPhone);
            
            if (!phoneToUse) {
                stats.noPhone++;
                continue;
            }

            const rawDate = row['Data'] || row['Data de criação'];
            const dateToUse = parseDateStr(rawDate);

            if (!dateToUse) {
                stats.noDate++;
                continue;
            }

            // Find contact
            const foundContacts = await db.select().from(contacts).where(
                and(
                    eq(contacts.companyId, COMPANY_ID),
                    ilike(contacts.phone, `%${phoneToUse.slice(-8)}%`)
                )
            );

            if (foundContacts.length === 0) {
                stats.contactNotFound++;
                continue;
            }

            const contactId = foundContacts[0].id;

            // Update contact
            await db.update(contacts)
                .set({ createdAt: dateToUse })
                .where(eq(contacts.id, contactId));
            stats.contactsUpdated++;

            // Update kanbanLeads
            const updatedLeads = await db.update(kanbanLeads)
                .set({ createdAt: dateToUse })
                .where(eq(kanbanLeads.contactId, contactId))
                .returning({ id: kanbanLeads.id });
            stats.leadsUpdated += updatedLeads.length;

            // Update conversations
            const updatedConvs = await db.update(conversations)
                .set({ createdAt: dateToUse })
                .where(eq(conversations.contactId, contactId))
                .returning({ id: conversations.id });
            stats.conversationsUpdated += updatedConvs.length;
        }
    }

    console.log('\n==============================');
    console.log('====== RESUMO DAS DATAS ======');
    console.log('==============================');
    console.log(`Linhas lidas no total: ${stats.totalRows}`);
    console.log(`Ignorados por falta de telefone: ${stats.noPhone}`);
    console.log(`Ignorados por falta de data: ${stats.noDate}`);
    console.log(`Contatos não encontrados: ${stats.contactNotFound}`);
    console.log(`\n✅ Contatos Atualizados: ${stats.contactsUpdated}`);
    console.log(`✅ Leads (Kanban) Atualizados: ${stats.leadsUpdated}`);
    console.log(`✅ Conversas Atualizadas: ${stats.conversationsUpdated}`);
    
    process.exit(0);
}

main().catch(console.error);
