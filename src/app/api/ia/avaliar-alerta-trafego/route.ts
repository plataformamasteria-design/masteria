import { NextRequest, NextResponse } from "next/server";
import { callAI, getModelName } from "@/lib/ai-client";
import { checkAIBudget, logAIUsage, estimateTokens } from "@/lib/ai-budget";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;

  const guard = await checkAIBudget("/api/ia/avaliar-alerta-trafego");
  if (guard.error) return guard.error;

  try {
    const { ad_id, adset_id, campaign_id, cliente_id, metrica, valor_atual } = await req.json();

    const systemPrompt = `Você é um especialista em otimização de Meta Ads para negócios locais e serviços high-ticket.
Analise este alerta de tráfego considerando boas práticas do mercado. Retorne APENAS JSON sem markdown:
{
  "severidade": "baixa" | "media" | "alta" | "critica",
  "causa_provavel": "string max 150 chars",
  "e_comportamento_toleravel": boolean,
  "justificativa": "string max 200 chars",
  "acao_recomendada": "string acao específica e objetiva",
  "acao_meta_api": "pausar_anuncio" | "pausar_conjunto" | null,
  "urgencia_horas": number,
  "regras_aplicadas": ["string nomes das regras"]
}`;

    const userContent = `ALERTA DISPARADO:
A métrica '${metrica}' atingiu o valor atual de: ${valor_atual}.

ID ANÚNCIO: ${ad_id || "N/A"}
ID CONJUNTO: ${adset_id || "N/A"}
ID CAMPANHA: ${campaign_id || "N/A"}

Avalie se este valor é preocupante e o que deve ser feito com a campanha/anúncio baseado nas melhores práticas do Meta Ads.`;

    const result = await callAI({
      provider: "openai",
      systemPrompt,
      userContent,
      maxTokens: 1000,
      companyId: user.companyId,
    });

    logAIUsage(guard.userId, "openai", getModelName("openai"), estimateTokens(userContent + result.text), "/api/ia/avaliar-alerta-trafego");

    let analise;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      analise = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.text);
    } catch {
      return NextResponse.json({ error: "Falha ao parsear resposta da IA", raw: result.text }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analise,
      regras_disparadas: ["Prática Padrão de Mercado"],
      pode_pausar_via_api: !!analise.acao_meta_api,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
