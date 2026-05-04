
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { isNotNull } from 'drizzle-orm';

async function diagnose() {
    try {
        console.log("🔍 Buscando TODOS os usuários com Facebook vinculado...");
        const linkedUsers = await db.select().from(users).where(isNotNull(users.facebookId));

        if (linkedUsers.length === 0) {
            console.log("❌ Nenhum usuário encontrado com facebookId no banco.");
        } else {
            console.log(`✅ Encontrados ${linkedUsers.length} usuários:`);
            linkedUsers.forEach(u => {
                console.log(`   - ID: ${u.id} | Linked: ${u.facebookId ? 'YES' : 'NO'}`);
            });
        }
    } catch (e) {
        console.error("Erro na diagnose:", e);
    }
}

diagnose();
