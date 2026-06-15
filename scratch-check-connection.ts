import { db } from './src/lib/db/index';
import { companies, connections } from './src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function checkConnection() {
    console.log('--- Buscando Empresa ---');
    const companyList = await db.select().from(companies).where(ilike(companies.name, '%empresa de desenvolvimento master%'));
    
    if (companyList.length === 0) {
        console.log('Empresa não encontrada.');
        return;
    }
    
    const company = companyList[0];
    console.log(`Empresa encontrada: ${company.name} (ID: ${company.id})`);
    
    console.log('\n--- Buscando Conexões da Camila ---');
    const connList = await db.select().from(connections).where(eq(connections.companyId, company.id));
    
    const camilaConns = connList.filter(c => c.config_name?.toLowerCase().includes('camila'));
    
    if (camilaConns.length === 0) {
        console.log('Nenhuma conexão com nome "Camila" encontrada nesta empresa.');
        console.log('Conexões existentes:');
        connList.forEach(c => console.log(`- ${c.config_name} (ID: ${c.id}, Type: ${c.connectionType}, Status: ${c.status})`));
        return;
    }
    
    for (const conn of camilaConns) {
        console.log(`\nConexão: ${conn.config_name}`);
        console.log(`ID: ${conn.id}`);
        console.log(`Type: ${conn.connectionType}`);
        console.log(`Session Name: ${conn.sessionName}`);
        console.log(`External ID (Evolution Name): ${conn.externalId}`);
        console.log(`Updated At: ${conn.updatedAt}`);
    }
}

checkConnection().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
