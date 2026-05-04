
import { db } from '../lib/db';
import { users, connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function verify() {
    try {
        const email = 'diegomaninhu@gmail.com';
        console.log(`🔍 Verificando usuário: ${email}`);
        const [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            console.log("❌ Usuário não encontrado!");
        } else {
            console.log(`✅ Usuário Encontrado: ${user.name}`);
            console.log(`🔗 Facebook Linked: ${user.facebookId ? 'SIM' : 'NÃO'}`);

            if (user.companyId) {
                console.log(`\n🔍 Verificando Conexões da Empresa (${user.companyId})...`);
                const userConnections = await db.select().from(connections).where(eq(connections.companyId, user.companyId));
                console.log(`✅ Encontradas ${userConnections.length} conexões.`);
                userConnections.forEach(c => {
                    console.log(`   - Nome: ${c.config_name} | Tipo: ${c.connectionType} | Status: ${c.status}`);
                });
            }
        }
    } catch (e) {
        console.error("Erro na verificação:", e);
    }
}

verify();
