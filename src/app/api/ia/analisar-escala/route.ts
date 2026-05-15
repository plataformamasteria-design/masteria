import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";
import { verifySession } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    const { campanhas } = await req.json();

    if (!campanhas || !Array.isArray(campanhas) || campanhas.length === 0) {
      return NextResponse.json({ error: "Nenhuma campanha enviada para análise." }, { status: 400 });
    }

    const resumo = campanhas.map((c: { nome: string; spend: number; leads: number; cpl: number; status: string }) =>
      `- ${c.nome}: Investido R$${c.spend.toFixed(2)}, ${c.leads} leads, CPL R$${c.cpl.toFixed(2)}, Status: ${c.status}`
    ).join("\n");

    const systemPrompt = `Você é um analista sênior de tráfego pago especializado em Meta Ads para uma agência de marketing digital brasileira.
Analise os dados das campanhas ativas e responda em português do Brasil, de forma direta e acionável.
Use formatação markdown com headers ##.
Sempre use valores em R$ (Real brasileiro).
REGRA DE ESCALA OBRIGATÓRIA: O aumento máximo de orçamento permitido é de 25% do valor atual por dia. Nunca recomende aumentos superiores a 25% de uma só vez. Se precisar escalar mais, sugira aumentos graduais de 20-25% ao longo de vários dias.`;

    const userContent = `Analise estas campanhas e responda EXATAMENTE nestes 3 tópicos:

## 1. Melhor campanha para escalar
Qual campanha tem o melhor CPL e mais headroom para aumentar o budget? Justifique com os números.

## 2. Conjuntos para pausar
Qual campanha/conjunto está com CPL acima da média e deveria ser pausado? Justifique.

## 3. Redistribuição de budget
Sugira uma redistribuição percentual do budget entre as campanhas ativas, explicando a lógica.

Dados das campanhas:
${resumo}

CPL médio geral: R$${(campanhas.reduce((s: number, c: { spend: number }) => s + c.spend, 0) / Math.max(campanhas.reduce((s: number, c: { leads: number }) => s + c.leads, 0), 1)).toFixed(2)}`;

    const result = await callAI({
      provider: "anthropic-haiku",
      systemPrompt,
      userContent,
      maxTokens: 1500,
    });

    return NextResponse.json({ analise: result.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
