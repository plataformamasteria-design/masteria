import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const StrictSaleSchema = z.object({
  isNewSaleClosedInThisConversation: z.boolean().describe("A negociação e a compra foram fechadas DURANTE esta exata conversa? (Retorne false se for suporte pós-venda, rastreio de pedido ou se ele já tinha comprado antes)"),
  saleValue: z.number().nullable().describe("Qual o valor final da compra mencionado? (null se não houver)"),
  productModel: z.string().nullable().describe("Qual foi o modelo/produto comprado? (null se não houver)")
});

async function run() {
  try {
    const dataPath = path.join(process.cwd(), 'scratch_won_sales.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const results = JSON.parse(rawData);

    const rawSales = results.rawSales;
    const convoIds = rawSales.map((r: any) => r.conversationId);

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

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const strictSales = [];
    
    // Process all 30 at once since it's a small number
    const promises = convoIds.map(async (convoId: string) => {
      const msgs = convoGroups.get(convoId);
      if (!msgs || msgs.length < 2) return null;

      const transcript = msgs.map(m => `[${m.senderType}]: ${m.content}`).join('\n');
      const finalTranscript = transcript.length > 8000 ? "... " + transcript.slice(-8000) : transcript;

      try {
        const { object } = await generateObject({
          model: openai('gpt-4o-mini', { structuredOutputs: true }),
          schema: StrictSaleSchema,
          prompt: `Analise esta conversa. O cliente FECHOU a compra AGORA, ou ele JÁ COMPROOU antes e está só pedindo rastreio/suporte?\n\nTranscrição:\n${finalTranscript}`,
        });
        return { conversationId: convoId, analysis: object };
      } catch (err) {
        return null;
      }
    });

    const chunkResults = await Promise.all(promises);
    strictSales.push(...chunkResults.filter(Boolean));
    
    let trueSalesCount = 0;
    let trueRevenue = 0;
    const trueModelsBought: Record<string, number> = {};

    for (const item of strictSales) {
      if (item && item.analysis && item.analysis.isNewSaleClosedInThisConversation) {
        trueSalesCount++;
        if (item.analysis.saleValue) trueRevenue += item.analysis.saleValue;
        if (item.analysis.productModel) {
          const model = item.analysis.productModel.toLowerCase().trim();
          trueModelsBought[model] = (trueModelsBought[model] || 0) + 1;
        }
      }
    }

    console.log("=========================================");
    console.log(`RESULTADO ESTREITO (VENDAS REAIS FECHADAS NO PERÍODO):`);
    console.log(`Total de Vendas Confirmadas AGORA: ${trueSalesCount}`);
    console.log(`Receita Total Estimada: R$ ${trueRevenue.toFixed(2)}`);
    console.log(`Modelos Vendidos:`);
    console.log(JSON.stringify(trueModelsBought, null, 2));
    console.log("=========================================");

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
