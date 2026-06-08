import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";
import { verifySession } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;

  try {
    const body = await req.json();
    const { investimento, cpl, leads, comparativos, alertasCriticos } = body;

    const systemPrompt = `Você é um analista sênior de tráfego pago. Analise os dados e retorne APENAS um JSON com:
- "resumo": string com exatamente 2 frases resumindo o período (máximo 120 caracteres cada)
- "acao": string com 1 ação prioritária recomendada (máximo 80 caracteres)
Sem markdown, sem explicação extra. Apenas o JSON.`;

    const userContent = `Dados do período:
- Investimento: R$ ${investimento}
- CPL atual: R$ ${cpl}
- Leads no período: ${leads}
- Comparativo com período anterior: ${comparativos}
- Alertas críticos ativos: ${alertasCriticos}

Analise e retorne o JSON.`;

    const result = await callAI({
      provider: "openai",
      systemPrompt,
      userContent,
      maxTokens: 300,
      companyId: user.companyId,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Resposta inválida da IA" }, { status: 500 });
    }

    const analise = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analise });
  } catch (error) {
    console.error("Erro na análise IA radar:", error);
    return NextResponse.json({ error: "Erro ao processar análise" }, { status: 500 });
  }
}
