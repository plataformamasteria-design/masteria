import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { db } = require('./src/lib/db');
const { kanbanLeads, kanbanBoards, contacts } = require('./src/lib/db/schema');
const { sql, eq } = require('drizzle-orm');

async function main() {
    console.log('Verificando duplicatas no Kanban (mesmo boardId e mesmo contactId)...');
    
    // Group by board_id, contact_id having count > 1
    const duplicates = await db.execute(sql`
        SELECT 
            kl.board_id, 
            kl.contact_id, 
            COUNT(*) as amount,
            b.name as board_name,
            c.name as contact_name
        FROM kanban_leads kl
        JOIN kanban_boards b ON kl.board_id = b.id
        JOIN contacts c ON kl.contact_id = c.id
        GROUP BY kl.board_id, kl.contact_id, b.name, c.name
        HAVING COUNT(*) > 1
        ORDER BY amount DESC
    `);
    
    if (duplicates.rows && duplicates.rows.length > 0) {
        console.log(`Encontrados ${duplicates.rows.length} contatos duplicados dentro do mesmo funil:`);
        duplicates.rows.forEach((row: any) => {
            console.log(`- Funil "${row.board_name}": Lead "${row.contact_name}" aparece ${row.amount} vezes.`);
        });
    } else {
        console.log('NENHUMA duplicata encontrada! Cada lead aparece apenas 1 vez dentro do seu próprio funil.');
    }
    
    process.exit(0);
}

main();
