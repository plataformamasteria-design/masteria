import { db } from '../src/lib/db';
import { connections, kanbanStagePersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('Desativando roteamento de IA nas conexões...');
    await db.update(connections).set({ assignedPersonaId: null });
    
    console.log('Deletando IAs vinculadas aos estágios do Kanban (Funil)...');
    await db.delete(kanbanStagePersonas);

    console.log('Sucesso! Todas as IAs de roteamento e funil foram desativadas.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
