import { db } from './src/lib/db/index.js';
import { automationFlowExecutions, contacts } from './src/lib/db/schema.js';
import { eq, and, ilike } from 'drizzle-orm';

async function main() {
    const contactRecords = await db.select({ id: contacts.id, name: contacts.name, phone: contacts.phone, companyId: contacts.companyId }).from(contacts).where(
        ilike(contacts.phone, '%8892161399%')
    );

    if (contactRecords.length === 0) {
        console.log("Contato não encontrado em nenhuma empresa.");
        process.exit(0);
    }

    for (const record of contactRecords) {
        console.log(`Contact ID: ${record.id} (${record.name}) Phone: ${record.phone} Company: ${record.companyId}`);
        
        const executions = await db.select().from(automationFlowExecutions).where(
            eq(automationFlowExecutions.contactId, record.id)
        );

        for (const exec of executions) {
            if (exec.status === 'running' || exec.status === 'paused' || exec.status === 'delayed') {
                await db.update(automationFlowExecutions)
                    .set({ status: 'failed' }) 
                    .where(eq(automationFlowExecutions.id, exec.id));
                console.log(`Execução ${exec.id} cancelada (status atualizado de ${exec.status} para 'failed').`);
            } else {
                console.log(`Execução ${exec.id} com status: ${exec.status}`);
            }
        }
    }

    process.exit(0);
}
main().catch(console.error);
