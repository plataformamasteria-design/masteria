import 'dotenv/config';
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { baileysAuthState } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('--- Verificando Cache de Login do Baileys (baileys_auth_state) ---');
    try {
        const authStates = await db
            .select({
                connectionId: baileysAuthState.connectionId,
                configName: connections.config_name,
                phone: connections.phone,
                status: connections.status,
                updatedAt: baileysAuthState.updatedAt,
            })
            .from(baileysAuthState)
            .innerJoin(connections, eq(baileysAuthState.connectionId, connections.id));

        if (authStates.length === 0) {
            console.log('\nNenhuma sessão encontrada com cache de login salvo no banco.');
        } else {
            console.log(`\nEncontradas ${authStates.length} sessões com cache ativo:`);
            authStates.forEach((state, idx) => {
                console.log(`\n[${idx + 1}] Nome: ${state.configName}`);
                console.log(`    Telefone: ${state.phone || 'N/A'}`);
                console.log(`    Status no DB: ${state.status}`);
                console.log(`    ID: ${state.connectionId}`);
                console.log(`    Última atualização do cache: ${state.updatedAt}`);
            });
        }
    } catch (error) {
        console.error('Erro ao consultar banco:', error);
    }
    process.exit(0);
}

main();
