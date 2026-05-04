
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { getInstagramUserProfile } from '../lib/facebookApiService';

async function testProfileSync() {
    // ID do usuário Instagram fornecido pelo usuário
    const igsid = "1896097054661185";

    try {
        console.log(`🔍 Testando sincronização de perfil para IGSID: ${igsid}`);

        // Buscar conexão do Instagram (assumindo que existe uma conexão configurada)
        const [connection] = await db.select().from(connections).where(eq(connections.connectionType, 'instagram'));

        if (!connection) {
            console.error("❌ Nenhuma conexão do Instagram encontrada no banco.");
            return;
        }

        console.log(`📡 Usando conexão: ${connection.config_name}`);

        const accessToken = decrypt(connection.accessToken!);
        if (!accessToken) {
            console.error("❌ Falha ao decriptar o token.");
            return;
        }

        console.log("🚀 Chamando getInstagramUserProfile...");
        const profile = await getInstagramUserProfile(igsid, accessToken);

        if (profile) {
            console.log("✅ Perfil obtido com sucesso!");
            console.log(`   - Nome: ${profile.name}`);
            console.log(`   - Pic: ${profile.profile_pic ? 'PRESENTE' : 'AUSENTE'}`);
        } else {
            console.log("❌ getInstagramUserProfile retornou NULL.");
            console.log("Verifique se o token tem a permissão 'instagram_basic'.");
        }

    } catch (e) {
        console.error("💥 Erro crítico no teste:", e);
    }
}

testProfileSync();
