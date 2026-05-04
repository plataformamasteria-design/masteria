
import { db } from '../lib/db';
import { users, connections } from '../lib/db/schema';
import { inArray, eq } from 'drizzle-orm';

async function checkDetails() {
    try {
        const targetEmails = ['diegomaninhu@gmail.com', 'diego_abner88@msn.com'];
        console.log(`🔍 Detalhando usuários (${targetEmails.length} contas)`);
        const userResults = await db.select().from(users).where(inArray(users.email, targetEmails));

        console.log(`👤 Usuários encontrados: ${userResults.length}`);

        console.log("\n🔌 Verificando CONEXÕES da empresa do diegomaninhu...");
        const diegoUser = userResults.find(u => u.email === 'diegomaninhu@gmail.com');
        if (diegoUser?.companyId) {
            const companyConns = await db.select().from(connections).where(eq(connections.companyId, diegoUser.companyId));
            console.log(`✅ ${companyConns.length} Conexões encontradas:`);
            companyConns.forEach(c => {
                console.log(`   - [${c.connectionType}] ${c.config_name} | Status: ${c.status}`);
            });
        }

    } catch (e) {
        console.error("Erro no checkDetail:", e);
    }
}

checkDetails();
