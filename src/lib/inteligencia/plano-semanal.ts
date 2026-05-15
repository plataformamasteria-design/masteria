/**
 * Gera plano semanal estrategico via IA (Gemini Flash, fallback Haiku).
 * Cache de 24h via supabase kv (tabela inteligencia_cache).
 */
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";
import type { AIProvider } from "@/lib/ai-client";
import { detectarAnomalias } from "./anomalias";
import { coletarDecisoesPendentes } from "./decisoes-pendentes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export interface AcaoSemanal {
  acao: string;
  por_que: string;
  impacto_estimado: string;
  prazo: string;
}

const SYSTEM_PROMPT = `Voce e o consultor estrategico da Comarka Ads, agencia de trafego pago para advogados em Feira de Santana-BA.
O dono (Lucas) te manda dados de anomalias e decisoes pendentes toda segunda.
Sua funcao: propor 4 acoes estrategicas pra ele executar na semana, em ordem de prioridade.

REGRAS:
- Foco em: escala, lucro, produtividade, retencao
- Sem fluff, sem genericidade. Cada acao com numero concreto ou nome de cliente/campanha
- Formato: retorne APENAS um JSON array com 4 objetos, cada um com:
  { "acao": "...", "por_que": "...", "impacto_estimado": "...", "prazo": "esta semana" ou "proximas 2 semanas" }
- Se nao tem dados suficientes, diga "dados insuficientes" na acao`;

export async function gerarPlanoSemanal(): Promise<AcaoSemanal[]> {
  // Verificar cache (24h)
  const { data: cached } = await supabase
    .from("inteligencia_cache")
    .select("valor, atualizado_em")
    .eq("chave", "plano_semanal")
    .maybeSingle();

  if (cached?.valor && cached.atualizado_em) {
    const age = Date.now() - new Date(cached.atualizado_em).getTime();
    if (age < 24 * 3600000) {
      try { return JSON.parse(cached.valor) as AcaoSemanal[]; } catch { /* cache corrompido */ }
    }
  }

  // Coletar dados pra IA
  const [anomalias, decisoes] = await Promise.all([
    detectarAnomalias(),
    coletarDecisoesPendentes(),
  ]);

  // KPIs rapidos
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [{ count: totalClientes }, { data: receitaData }] = await Promise.all([
    supabase.from("clientes_receita").select("*", { count: "exact", head: true }).in("status_financeiro", ["ativo", "pagou_integral", "parceria"]),
    supabase.from("pagamentos_mensais").select("valor").eq("mes_referencia", mesAtual),
  ]);

  const receita = (receitaData || []).reduce((s, r) => s + Number(r.valor || 0), 0);

  const contexto = `
ANOMALIAS DETECTADAS (${anomalias.length}):
${anomalias.map(a => `- [${a.severidade.toUpperCase()}] ${a.mensagem}`).join("\n") || "Nenhuma anomalia critica"}

DECISOES PENDENTES (${decisoes.length}):
${decisoes.map(d => `- [${d.prioridade.toUpperCase()}] ${d.titulo}: ${d.descricao}`).join("\n") || "Nenhuma decisao pendente"}

KPIs DO MES (${mesAtual}):
- Clientes ativos: ${totalClientes || 0}
- Receita parcial: R$ ${receita.toFixed(2)}
- Data: ${new Date().toISOString().slice(0, 10)}
`;

  // Chamar IA (Gemini Flash primeiro, fallback Haiku)
  let result: AcaoSemanal[] = [];
  const providers: AIProvider[] = ["gemini", "anthropic-haiku"];

  for (const provider of providers) {
    try {
      const resp = await callAI({
        provider,
        systemPrompt: SYSTEM_PROMPT,
        userContent: contexto,
        maxTokens: 800,
      });

      // Extrair JSON do response
      const text = resp.text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
        if (Array.isArray(result) && result.length > 0) break;
      }
    } catch {
      continue;
    }
  }

  // Fallback se IA falhar
  if (!result || result.length === 0) {
    result = [{
      acao: "Revisar anomalias e decisoes pendentes manualmente",
      por_que: "IA nao conseguiu gerar plano automaticamente",
      impacto_estimado: "Depende da analise manual",
      prazo: "esta semana",
    }];
  }

  // Salvar cache
  await supabase.from("inteligencia_cache").upsert({
    chave: "plano_semanal",
    valor: JSON.stringify(result.slice(0, 4)),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "chave" });

  return result.slice(0, 4);
}
