import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const SaleSchema = z.object({
  isActualSale: z.boolean().describe("Houve realmente o fechamento de uma compra/venda na conversa? (Pode ser que seja apenas suporte ou manutenção)"),
  saleValue: z.number().nullable().describe("Qual o valor final da compra mencionado? (Se não tiver valor explícito, retorne null)"),
  productModel: z.string().nullable().describe("Qual foi o modelo/produto exato comprado (ex: Bebedouro 50 litros, 100 litros, filtro, etc)? (Se não tiver, retorne null)")
});

async function run() {
  console.log("Iniciando auditoria das conversas não perdidas...");

  try {
    const dataPath = path.join(process.cwd(), 'scratch_analysis_results.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const results = JSON.parse(rawData);

    // Filtra as conversas que NÃO foram classificadas como venda perdida
    const possibleSales = results.filter((r: any) => !r.analysis.wasLostSale);
    console.log(`Encontradas ${possibleSales.length} conversas com potencial de venda concluída.`);

    const convoIds = possibleSales.map((r: any) => r.conversationId);

    // Busca as mensagens apenas dessas conversas
    const allMsgs = await db.select({
      conversationId: messages.conversationId,
      content: messages.content,
      senderType: messages.senderType,
      sentAt: messages.sentAt
    })
    .from(messages)
    .where(inArray(messages.conversationId, convoIds))
    .orderBy(asc(messages.sentAt));

    const convoGroups = new Map<string, typeof allMsgs>();
    for (const msg of allMsgs) {
      if (!convoGroups.has(msg.conversationId)) {
        convoGroups.set(msg.conversationId, []);
      }
      convoGroups.get(msg.conversationId)!.push(msg);
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const finalSales = [];
    let processed = 0;
    const chunk_size = 20; 
    
    for (let i = 0; i < convoIds.length; i += chunk_size) {
      const chunk = convoIds.slice(i, i + chunk_size);
      console.log(`Processando lote de análise de vendas ${Math.floor(i/chunk_size) + 1}...`);
      
      const promises = chunk.map(async (convoId: string) => {
        const msgs = convoGroups.get(convoId);
        if (!msgs || msgs.length < 2) return null;

        const transcript = msgs.map(m => `[${m.senderType}]: ${m.content}`).join('\n');
        const finalTranscript = transcript.length > 8000 ? "... " + transcript.slice(-8000) : transcript;

        try {
          const { object } = await generateObject({
            model: openai('gpt-4o-mini', { structuredOutputs: true }),
            schema: SaleSchema,
            prompt: `Analise a seguinte conversa de WhatsApp entre um cliente e a empresa.\n\nTranscrição:\n${finalTranscript}\n\nO cliente fechou uma compra? Se sim, qual foi o valor e qual o produto?`,
          });
          return { conversationId: convoId, analysis: object };
        } catch (err) {
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      finalSales.push(...chunkResults.filter(Boolean));
      processed += chunk.length;
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Processamento concluído. Verificando vendas confirmadas...`);
    
    let totalSalesCount = 0;
    let totalRevenue = 0;
    const modelsBought: Record<string, number> = {};

    for (const item of finalSales) {
      if (item && item.analysis && item.analysis.isActualSale) {
        totalSalesCount++;
        if (item.analysis.saleValue) {
          totalRevenue += item.analysis.saleValue;
        }
        if (item.analysis.productModel) {
          const model = item.analysis.productModel.toLowerCase().trim();
          modelsBought[model] = (modelsBought[model] || 0) + 1;
        }
      }
    }

    console.log("=========================================");
    console.log(`RESULTADO DAS VENDAS:`);
    console.log(`Total de Vendas Confirmadas: ${totalSalesCount}`);
    console.log(`Receita Total Estimada: R$ ${totalRevenue.toFixed(2)}`);
    console.log(`Modelos Vendidos:`);
    console.log(JSON.stringify(modelsBought, null, 2));
    console.log("=========================================");

    const outPath = path.join(process.cwd(), 'scratch_won_sales.json');
    await fs.writeFile(outPath, JSON.stringify({
      totalSalesCount,
      totalRevenue,
      modelsBought,
      rawSales: finalSales.filter(f => f && f.analysis.isActualSale)
    }, null, 2));

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
