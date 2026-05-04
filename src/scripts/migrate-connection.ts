
import 'dotenv/config';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function migrateConnection() {
    const OLD_COMPANY_ID = '3ded990b-98cd-410b-9a84-f87b6c738000'; // Dalton's (wrong slug)
    const NEW_COMPANY_ID = '9fca0bf3-57b1-47ff-aed1-bbc5c2cb2d76'; // Diego's (correct slug)

    console.log('🔧 Migrando conexões Instagram para a empresa correta...\n');

    // Find Instagram connections on old company
    const igConnections = await db.select({
        id: connections.id,
        name: connections.config_name,
        type: connections.connectionType,
    })
        .from(connections)
        .where(eq(connections.companyId, OLD_COMPANY_ID));

    console.log(`📋 Conexões na empresa antiga: ${igConnections.length}`);
    igConnections.forEach(c => console.log(`   - ${c.name} (${c.type})`));

    if (igConnections.length > 0) {
        console.log('\n🔄 Movendo conexões para a empresa correta...');
        await db.update(connections)
            .set({ companyId: NEW_COMPANY_ID })
            .where(eq(connections.companyId, OLD_COMPANY_ID));
        console.log('✅ Conexões movidas.');
    } else {
        console.log('ℹ️ Nenhuma conexão para mover.');
    }

    // Verify
    const newConnections = await db.select({
        id: connections.id,
        name: connections.config_name,
        type: connections.connectionType,
    })
        .from(connections)
        .where(eq(connections.companyId, NEW_COMPANY_ID));

    console.log(`\n📋 Conexões na empresa correta agora: ${newConnections.length}`);
    newConnections.forEach(c => console.log(`   - ${c.name} (${c.type})`));

    console.log('\n✅ Migração concluída.');
    process.exit(0);
}

migrateConnection();
