import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketingAds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { callAI, getModelName } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { criativo_id } = await req.json();
    if (!criativo_id) {
      return NextResponse.json({ error: "criativo_id (ad_id) obrigatório" }, { status: 400 });
    }

    // Buscar criativo de marketingAds
    const ads = await db.select().from(marketingAds).where(eq(marketingAds.adId, criativo_id));
    const criativo = ads.length > 0 ? ads[0] : null;

    if (!criativo) {
      return NextResponse.json({ error: "Criativo não encontrado" }, { status: 404 });
    }

    const conteudo = criativo.creativeBody || criativo.creativeTitle || "(sem texto disponível)";

    const systemPrompt = `Você é especialista em copy jurídico e marketing digital para Meta Ads. Analise este criativo e retorne APENAS JSON válido sem markdown:
{
  "pontos_fortes": ["string"],
  "pontos_fracos": ["string"],
  "score": number,
  "gatilhos_identificados": ["string"],
  "publico_provavel": "string",
  "sugestoes_copy": [
    {
      "versao": "A",
      "headline": "string",
      "copy_completo": "string",
      "justificativa": "string",
      "baseado_em": "string"
    }
  ],
  "alerta_compliance": "string ou null"
}`;

    const userContent = `CRIATIVO: ${criativo.adName}
TIPO: Anúncio do Meta
CONTEÚDO:
${conteudo}`;

    // Note: AI usage requires OPENAI_API_KEY or ANTHROPIC_API_KEY, relying on ai-client wrapper
    const result = await callAI({
      provider: "anthropic-haiku",
      systemPrompt,
      userContent,
      maxTokens: 2000,
    });

    let analise;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      analise = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.text);
    } catch {
      return NextResponse.json({ error: "Falha ao parsear resposta da IA", raw: result.text }, { status: 500 });
    }

    // Opcional: Salvar no rawData
    const currentRaw = (criativo.rawData as any) || {};
    currentRaw.analise_resultado = analise;
    
    await db.update(marketingAds)
      .set({ rawData: currentRaw })
      .where(eq(marketingAds.adId, criativo_id));

    return NextResponse.json({ success: true, analise });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
