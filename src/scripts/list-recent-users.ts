
import { db } from '../lib/db';
import { users, connections } from '../lib/db/schema';

async function diagnose() {
    try {
        console.log("🔍 [USUÁRIOS] Buscando todos os usuários...");
        const allUsers = await db.select().from(users);

        console.log(`✅ Encontrados ${allUsers.length} usuários.`);
        allUsers.forEach(u => {
            console.log(`   - ID: ${u.id} | Role: ${u.role} | FB Linked: ${u.facebookId ? 'YES' : 'NO'}`);
        });

        console.log("\n🔍 [CONEXÕES] Buscando conexões recentes...");
        const allConnections = await db.select().from(connections);
        console.log(`✅ Encontradas ${allConnections.length} conexões.`);
        allConnections.forEach(c => {
            console.log(`   - ID: ${c.id} | Nome: ${c.config_name} | Tipo: ${c.connectionType} | Status: ${c.status}`);
        });

    } catch (e) {
        console.error("Erro na diagnose:", e);
    }
}

diagnose();
