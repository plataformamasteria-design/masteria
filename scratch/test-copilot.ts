import { db } from '../src/lib/db';
import { companies, contactLists, messageTemplates } from '../src/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { executeCopilotCommand } from '../src/lib/copilot-engine';

async function run() {
    const company = await db.query.companies.findFirst({
        where: eq(companies.name, "Empresa de Desenvolvimento Master")
    });
    if (!company) throw new Error("Empresa não encontrada");
    
    console.log("Company ID:", company.id);

    const list = await db.query.contactLists.findFirst({
        where: and(eq(contactLists.companyId, company.id), eq(contactLists.name, "lista teste"))
    });
    
    console.log("Lista teste ID:", list?.id);

    const templates = await db.query.messageTemplates.findMany({
        where: and(eq(messageTemplates.companyId, company.id), eq(messageTemplates.status, "APPROVED")),
        orderBy: [desc(messageTemplates.createdAt)],
        limit: 1
    });

    console.log("Template aprovado mais recente:", templates[0]?.name, templates[0]?.id);

    // Agora vamos testar o copilot mandando disparar para a lista "lista teste" usando o ultimo template aprovado.
    console.log("Disparando comando do copilot...");
    const prompt = `Faça um disparo de template para a lista "lista teste". Use o template "${templates[0]?.name}" que acabou de ser aprovado. Liste os números oficiais disponíveis e use o primeiro da lista para fazer o envio imediato, sem agendamento.`;
    
    const res = await executeCopilotCommand(
        prompt,
        company.id,
        undefined, // sem historico
        0
    );

    console.log("Copilot Response:", JSON.stringify(res, null, 2));
    
    process.exit(0);
}
run().catch(console.error);
