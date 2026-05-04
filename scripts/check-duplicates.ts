
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
    console.log('🔍 Verificando duplicatas na tabela "contacts"...');

    try {
        const result: any = await db.execute(sql`
      SELECT phone, company_id, COUNT(*) 
      FROM contacts 
      GROUP BY phone, company_id 
      HAVING COUNT(*) > 1
    `);

        const rows = Array.isArray(result) ? result : (result.rows || []);

        if (rows.length > 0) {
            console.warn('⚠️ Encontradas duplicatas em "contacts":');
            rows.forEach((r: any) => {
                console.log(`- Telefone: ${r.phone}, Empresa: ${r.company_id}, Ocorrências: ${r.count}`);
            });
        } else {
            console.log('✅ Nenhuma duplicata encontrada em "contacts".');
        }
        process.exit(0);
    } catch (error: any) {
        console.error('❌ ERRO ao verificar duplicatas:', error.message);
        process.exit(1);
    }
}

checkDuplicates();
