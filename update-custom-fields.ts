import fs from 'fs';
import * as dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { contacts } = require('./src/lib/db/schema');
const { ilike, eq, and } = require('drizzle-orm');

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

const files = [
    '20260525-antonio-3gcr-inside-sales-dictqrqo2yzjrvysh1n4o1xhb.xlsx',
    '20260525-antonio-diagnostico-empresarial-funil-mentoria-mcbwxkbj5fafanbdr6gwp1xun.xlsx',
    '20260525-aplicacao-7-edn-encontro-de-negocios-alphaville-antonio-rgtdin8xjmwdsjnylppi43djh.xlsx',
    '20260525-encontro-de-casais-n8lfobymxrhwthg63pkstay4x.xlsx'
];

// Keys to NOT inject into customFields
const IGNORE_KEYS = [
    'ID',
    'Pontuação',
    'Data',
    // We can include 'Qual seu Whatsapp?' or 'Qual seu nome?' in custom fields since they are answers too.
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
    let stats = {
        totalRows: 0,
        noPhone: 0,
        contactNotFound: 0,
        contactsUpdated: 0
    };

    for (const filename of files) {
        const filePath = path.join(__dirname, 'FORM FUNIL', filename);
        console.log(`\nProcessando campos personalizados de ${filename}...`);
        
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
            
            const rawPhone = row['Qual seu Whatsapp?'] || row['Descreva um número que podemos entrar em contato'] || row['Telefone'];
            const phoneToUse = normalizePhone(rawPhone);
            
            if (!phoneToUse) {
                stats.noPhone++;
                continue;
            }

            // 1. Find the contact
            const foundContacts = await db.select().from(contacts).where(
                and(
                    eq(contacts.companyId, COMPANY_ID),
                    ilike(contacts.phone, `%${phoneToUse.slice(-8)}%`)
                )
            );

            if (foundContacts.length === 0) {
                stats.contactNotFound++;
                continue; // Should exist because we just imported them
            }

            const contact = foundContacts[0];
            
            // 2. Prepare custom fields
            const extractedCustomFields: Record<string, string> = {};
            
            for (const key of Object.keys(row)) {
                if (!IGNORE_KEYS.includes(key)) {
                    // Stringify values to avoid issues
                    extractedCustomFields[key] = String(row[key]);
                }
            }

            // 3. Merge with existing
            const existingCustomFields = contact.customFields || {};
            const mergedCustomFields = {
                ...existingCustomFields,
                ...extractedCustomFields
            };

            // 4. Update Database
            await db.update(contacts)
                .set({ customFields: mergedCustomFields })
                .where(eq(contacts.id, contact.id));
                
            stats.contactsUpdated++;
        }
    }

    console.log('\n==============================');
    console.log('====== RESUMO DOS CAMPOS ====');
    console.log('==============================');
    console.log(`Linhas lidas no total: ${stats.totalRows}`);
    console.log(`Ignorados por falta de telefone: ${stats.noPhone}`);
    console.log(`Contatos não encontrados: ${stats.contactNotFound}`);
    console.log(`\n✅ CONTATOS ATUALIZADOS: ${stats.contactsUpdated}`);
    
    process.exit(0);
}

main().catch(console.error);
