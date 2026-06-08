import { NextRequest, NextResponse } from "next/server";
import { callAI, getModelName } from "@/lib/ai-client";
import { checkAIBudget, logAIUsage, estimateTokens } from "@/lib/ai-budget";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;
  const userId = user.employeeId;

  const guard = await checkAIBudget("/api/meta/ad-intelligence/diagnose");
  if (guard.error) return guard.error;

  try {
    const { metrics, provider } = await req.json();

    if (!metrics || metrics.length === 0) {
      return NextResponse.json({ diagnosis: "Nenhuma métrica disponível para análise.", recommendation: "Verifique se a conta possui campanhas ativas e gerou dados no período selecionado." });
    }

    const payloadString = JSON.stringify(metrics, null, 2);

    const systemPrompt = `Você é um Analista Executivo de Tráfego Pago, especialista em otimização de campanhas no Meta Ads.
Você receberá um JSON contendo as métricas de campanhas de tráfego de um cliente.
Sua missão é gerar um relatório rápido e acionável.
As métricas 'leads' representam os resultados gerados (podem ser mensagens, compras ou cadastros). 'cpl' é o Custo por Resultado. 'score' é uma nota de saúde de 0 a 100 baseada no CTR e Custo por Resultado.

Você DEVE retornar a sua resposta EXATAMENTE E APENAS em formato JSON válido, contendo as chaves "diagnosis" e "recommendation".
A chave "diagnosis" (string) deve conter uma avaliação executiva do cenário, identificando onde estamos acertando e onde estamos errando (máximo 4 frases curtas).
A chave "recommendation" (string) deve listar 2 a 3 ações práticas de otimização (pausar, escalar, testar novos públicos).

NÃO retorne formatação markdown \`\`\`json. Apenas o objeto JSON puro.`;

    const userPrompt = `Analise os dados abaixo e retorne APENAS um objeto JSON com as chaves "diagnosis" e "recommendation":
${payloadString}`;

    const aiRes = await callAI({
      provider: provider || "openai",
      systemPrompt,
      userContent: userPrompt,
      maxTokens: 1000,
      companyId: user.companyId,
    });

    let rawText = aiRes.text.trim();
    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(rawText);
      }
    } catch (e) {
      console.error("Failed to parse AI JSON:", rawText);
      parsed = {
        diagnosis: "A Inteligência Artificial gerou uma resposta em formato inválido.",
        recommendation: "Por favor, tente gerar a análise novamente.",
      };
    }

    logAIUsage(userId, provider || "openai", getModelName(provider || "openai"), estimateTokens(systemPrompt + userPrompt + aiRes.text), "/api/meta/ad-intelligence/diagnose");

    return NextResponse.json({
      diagnosis: parsed.diagnosis || parsed.diagnostico || parsed.diagnóstico || parsed.Diagnosis || "Não foi possível gerar um diagnóstico inteligível.",
      recommendation: parsed.recommendation || parsed.recomendacao || parsed.recomendação || parsed.Recommendation || "Não há recomendações claras no momento."
    });

  } catch (e: any) {
    console.error("[api/meta/ad-intelligence/diagnose]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
