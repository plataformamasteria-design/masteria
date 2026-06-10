import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    try {
        const instances = await evolutionApiService.fetchAllInstances();
        console.log("Active instances in Evolution API:", JSON.stringify(instances, null, 2));
        
        const allConns = await db.select().from(connections);
        console.log("Connections in DB:", allConns.filter(c => c.connectionType === 'evolution' || c.connectionType === 'baileys').map(c => ({id: c.id, sessionName: c.sessionName, status: c.status, companyId: c.companyId})));

    } catch (e: any) {
        console.error("ERRO:", e.message);
    }
    process.exit(0);
}

test();
