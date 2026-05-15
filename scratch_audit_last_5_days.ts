import 'dotenv/config';
import { db } from './src/lib/db';
import { messages, conversations, contacts, companies } from './src/lib/db/schema';
import { eq, inArray, asc, gte, and } from 'drizzle-orm';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const StrictSaleSchema = z.object({
  isNewSaleClosed: z.boolean().describe("A venda foi EFETIVAMENTE FECHADA nos últimos trechos desta conversa? Retorne false se o cliente apenas perguntou, ou se for rastreio de um pedido antigo."),
  saleValue: z.number().nullable().describe("Qual o valor final da compra mencionado? (null se não houver)"),
  productModel: z.string().nullable().describe("Qual foi o modelo/produto comprado? (null se não houver)")
});

async function run() {
  console.log("Iniciando auditoria de vendas dos últimos 5 dias...");

  try {
    const orgs = await db.select().from(companies).where(eq(companies.name, "Henrique Felipe Alves's Company"));
    let targetOrg = orgs[0];

    if (!targetOrg) {
      const allOrgs = await db.select({ id: companies.id, name: companies.name }).from(companies);
      targetOrg = allOrgs.filter(o => o.name?.toLowerCase().includes('henrique felipe'))[0];
    }
    const orgId = targetOrg.id;

    // Calcular a data de 5 dias atrás (9 de Maio de 2026)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    
    console.log(`Filtrando mensagens a partir de: ${fiveDaysAgo.toISOString()}`);

    // 1. Pegar IDs das conversas que tiveram alguma mensagem nos últimos 5 dias
    const recentMsgs = await db.select({
      conversationId: messages.conversationId
    })
    .from(messages)
    .where(and(
      eq(messages.companyId, orgId),
      gte(messages.sentAt, fiveDaysAgo)
    ));

    const recentConvoIds = [...new Set(recentMsgs.map(m => m.conversationId))];
    console.log(`Conversas ativas nos últimos 5 dias: ${recentConvoIds.length}`);

    if (recentConvoIds.length === 0) {
      console.log("Nenhuma conversa encontrada neste período.");
      return;
    }

    // 2. Pegar todas as mensagens dessas conversas para ter o contexto completo (ou pelo menos as mais recentes)
    const allMsgs = await db.select({
      conversationId: messages.conversationId,
      content: messages.content,
      senderType: messages.senderType,
      sentAt: messages.sentAt
    })
    .from(messages)
    .where(inArray(messages.conversationId, recentConvoIds))
    .orderBy(asc(messages.sentAt));

    const convoGroups = new Map<string, typeof allMsgs>();
    for (const msg of allMsgs) {
      if (!convoGroups.has(msg.conversationId)) convoGroups.set(msg.conversationId, []);
      convoGroups.get(msg.conversationId)!.push(msg);
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const strictSales = [];
    
    // Processamento em lotes de 20 para evitar Rate Limit
    const chunk_size = 20; 
    for (let i = 0; i < recentConvoIds.length; i += chunk_size) {
      const chunk = recentConvoIds.slice(i, i + chunk_size);
      console.log(`Analisando lote ${Math.floor(i/chunk_size) + 1} de ${Math.ceil(recentConvoIds.length/chunk_size)}...`);
      
      const promises = chunk.map(async (convoId: string) => {
        const msgs = convoGroups.get(convoId);
        if (!msgs || msgs.length < 2) return null;

        const transcript = msgs.map(m => `[${m.sentAt.toISOString()}] [${m.senderType}]: ${m.content}`).join('\n');
        const finalTranscript = transcript.length > 8000 ? "... " + transcript.slice(-8000) : transcript;

        try {
          const { object } = await generateObject({
            model: openai('gpt-4o-mini', { structuredOutputs: true }),
            schema: StrictSaleSchema,
            prompt: `Analise esta conversa. Verifique se o cliente FECHOU (concluiu) uma nova compra EXATAMENTE nos últimos 5 dias. Ignore orçamentos não fechados, abandonos, e mensagens de rastreio de clientes antigos.\n\nTranscrição:\n${finalTranscript}`,
          });
          return { conversationId: convoId, analysis: object };
        } catch (err) {
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      strictSales.push(...chunkResults.filter(Boolean));
      await new Promise(r => setTimeout(r, 1000));
    }

    const trueSales = strictSales.filter(item => item && item.analysis && item.analysis.isNewSaleClosed);
    const trueConvoIds = trueSales.map(item => item!.conversationId);

    if (trueConvoIds.length === 0) {
      console.log("=========================================");
      console.log("Nenhuma venda confirmada nos últimos 5 dias.");
      console.log("=========================================");
      return;
    }

    // 3. Cruzar com dados de Contatos
    const convos = await db.select({
      conversationId: conversations.id,
      contactName: contacts.name,
      contactPhone: contacts.phone
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(inArray(conversations.id, trueConvoIds));

    let totalRevenue = 0;

    console.log("=========================================");
    console.log("VENDAS REALIZADAS NOS ÚLTIMOS 5 DIAS (09/05 até 14/05):");
    
    trueSales.forEach(sale => {
      const convoData = convos.find(c => c.conversationId === sale!.conversationId);
      const name = convoData?.contactName || "Desconhecido";
      const phone = convoData?.contactPhone || "Sem telefone";
      const model = sale!.analysis.productModel || "Produto não especificado";
      const valNumber = sale!.analysis.saleValue;
      const val = valNumber ? `R$ ${valNumber.toFixed(2)}` : "Valor não explícito";
      
      if (valNumber) totalRevenue += valNumber;
      
      console.log(`- **${name}** (${phone}) | Produto: ${model} | Valor: ${val}`);
    });
    
    console.log("-----------------------------------------");
    console.log(`TOTAL DE RECEITA NO PERÍODO: R$ ${totalRevenue.toFixed(2)}`);
    console.log("=========================================");

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
