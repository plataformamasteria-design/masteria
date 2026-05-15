import 'dotenv/config';
import { db } from './src/lib/db';
import { companies, conversations, messages, contacts } from './src/lib/db/schema';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Zod Schema para saída do LLM
const AnalysisSchema = z.object({
  wasLostSale: z.boolean().describe("Houve uma venda perdida ou abandono claro do lead antes do fechamento?"),
  abandonmentPoint: z.enum(['NONE', 'NO_RESPONSE', 'PRICE_OBJECTION', 'DOUBT', 'LACK_OF_INFO', 'DISSATISFACTION', 'OTHER']).describe("Se foi perdido, qual o motivo/ponto do abandono?"),
  dissatisfactionReason: z.string().nullable().describe("Se o lead mostrou insatisfação, qual foi o motivo? (Se não, retorne null)"),
  summary: z.string().describe("Breve resumo (1-2 frases) de por que a venda não aconteceu ou do comportamento do lead."),
  keyObjection: z.string().nullable().describe("Qual foi a principal objeção de venda (ex: 'Achei caro', 'Muito longe', 'Não entendi')? Retorne null se não houve.")
});

async function run() {
  console.log("Iniciando auditoria MAX para Henrique Felipe Alves...");

  try {
    const orgs = await db.select().from(companies).where(eq(companies.name, "Henrique Felipe Alves's Company"));
    let targetOrg = orgs[0];

    if (!targetOrg) {
      console.log("Org not found by exact name, falling back...");
      const allOrgs = await db.select({ id: companies.id, name: companies.name }).from(companies);
      targetOrg = allOrgs.filter(o => o.name?.toLowerCase().includes('henrique felipe'))[0];
    }

    if (!targetOrg) {
      console.log("Organization not found.");
      return;
    }

    const orgId = targetOrg.id;
    console.log(`Org ID: ${orgId}`);

    // Fetch conversations
    const allConvos = await db.select({
      id: conversations.id,
      contactId: conversations.contactId,
      status: conversations.status
    }).from(conversations).where(eq(conversations.companyId, orgId));

    console.log(`Total conversations: ${allConvos.length}`);

    // Fetch messages for all convos
    const allMsgs = await db.select({
      id: messages.id,
      conversationId: messages.conversationId,
      content: messages.content,
      senderType: messages.senderType,
      sentAt: messages.sentAt
    })
    .from(messages)
    .where(eq(messages.companyId, orgId))
    .orderBy(asc(messages.sentAt));

    console.log(`Total messages: ${allMsgs.length}`);

    // Group messages by conversation
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

    const results = [];
    let processed = 0;
    
    // We will process in chunks to respect rate limits.
    const chunk_size = 20; 
    const convoKeys = Array.from(convoGroups.keys());
    
    for (let i = 0; i < convoKeys.length; i += chunk_size) {
      const chunk = convoKeys.slice(i, i + chunk_size);
      console.log(`Processando lote ${Math.floor(i/chunk_size) + 1} de ${Math.ceil(convoKeys.length / chunk_size)}...`);
      
      const promises = chunk.map(async (convoId) => {
        const msgs = convoGroups.get(convoId)!;
        if (msgs.length < 2) return null; // Ignorar conversas com menos de 2 mensagens

        // Montar a transcrição
        const transcript = msgs.map(m => `[${m.senderType}]: ${m.content}`).join('\n');
        
        // Se a transcrição for muito longa, pegamos o final onde geralmente ocorre o abandono/fechamento
        const finalTranscript = transcript.length > 8000 ? "... " + transcript.slice(-8000) : transcript;

        try {
          const { object } = await generateObject({
            model: openai('gpt-4o-mini', { structuredOutputs: true }),
            schema: AnalysisSchema,
            prompt: `Analise a seguinte conversa de WhatsApp entre um Lead e a empresa (Atendente/IA).\n\nTranscrição:\n${finalTranscript}\n\nExtraia os dados de vendas, perda, abandono e objeções conforme o schema.`,
          });
          return { conversationId: convoId, analysis: object };
        } catch (err) {
          console.error(`Erro ao processar conv ${convoId}:`, err);
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter(Boolean));
      processed += chunk.length;
      
      // Pequena pausa para rate limit
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Processamento concluído. Conversas válidas analisadas: ${results.length}`);
    
    // Salvar resultados temporários
    const outPath = path.join(process.cwd(), 'scratch_analysis_results.json');
    await fs.writeFile(outPath, JSON.stringify(results, null, 2));
    console.log(`Resultados salvos em ${outPath}`);

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
