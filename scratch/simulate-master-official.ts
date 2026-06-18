import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const { triggerFlow } = await import('../src/lib/flow-engine');
    const { db } = await import('../src/lib/db');

    try {
        const contact = await db.query.contacts.findFirst({
            where: (contacts, { eq, and }) => and(eq(contacts.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149'), eq(contacts.phone, '+5588920008007'))
        });

        if (!contact) {
            console.log('Lead não encontrado.');
            return;
        }

        console.log(`Found lead: ${contact.whatsappName} (${contact.phone}) - ID: ${contact.id}`);

        const flow = await db.query.automationFlows.findFirst({
            where: (flows, { eq }) => eq(flows.id, '5f345023-dcde-4201-8f2c-06d9c7e9ae78')
        });

        if (!flow) {
            console.log('Nenhum fluxo ativo encontrado.');
            return;
        }

        console.log(`Using Flow: ${flow.name} (ID: ${flow.id})`);

        // Simula uma mensagem chegando e sendo roteada para o nó do Copilot via API OFICIAL (cloudapi)
        // Isso força a engine a assumir esse provedor de conexão
        const mockPayload = {
            message: "quero saber sobre campanhas de trafego pago",
            companyId: contact.companyId,
            contactId: contact.id,
            connectionId: '81994284-e8f0-4a2b-b17b-a9440a0d563a', // Official API (meta_api) connection
            provider: 'cloudapi'
        };

        console.log(`Triggering flow for message: "${mockPayload.message}"`);

        await triggerFlow(
            flow.id,
            mockPayload.companyId,
            mockPayload.contactId,
            {
                message_text: mockPayload.message,
                connectionId: mockPayload.connectionId,
                provider: mockPayload.provider
            }
        );

        console.log("\n--- Aguardando processamento async do fluxo... (10s) ---");
        await new Promise(r => setTimeout(r, 10000));

        // Busca o ultimo log de execucao deste fluxo para este contato
        const logs = await db.query.automationExecutionLogs.findMany({
            where: (logs, { eq, and }) => and(
                eq(logs.flowId, flow.id),
                eq(logs.contactId, contact.id)
            ),
            orderBy: (logs, { desc }) => [desc(logs.createdAt)],
            limit: 1
        });

        console.log("\n--- Execution Logs ---");
        if (logs.length > 0) {
            const lastLog = logs[0];
            const nodeLogs = Array.isArray(lastLog.nodeLogs) ? lastLog.nodeLogs : [];
            for (const n of nodeLogs) {
                console.log(`[${(n as any).nodeId}] ${(n as any).status}: ${(n as any).output?.message || ''}`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
