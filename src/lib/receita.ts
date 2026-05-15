/**
 * receita.ts — Fonte única de cálculo de receita mensal.
 *
 * REGRA: Todos os módulos (Entradas, DRE, Fluxo de Caixa, Resumo/Painel)
 * DEVEM usar esta função para calcular receita por mês.
 *
 * Fonte de dados:
 *   Tabela: `pagamentos_mensais`
 *   Campo somado: `valor_pago`
 *   Filtro: `status = 'pago'` (somente dinheiro que efetivamente entrou)
 *   Mês: `mes_referencia` (formato YYYY-MM-01, representa o mês de competência do pagamento)
 *
 * Override: Quando existe `config_mensal.receita_realizada` para o mês (valor conferido
 * manualmente da planilha), esse valor prevalece sobre a soma de pagamentos.
 *
 * NÃO inclui:
 *   - `contratos.valor_entrada` — esse campo é contratual, não representa recebimento efetivo.
 *     Entradas únicas de fee são registradas via `pagamentos_mensais` quando recebidas.
 *   - Pagamentos com status diferente de "pago" (pendente, parceria, perdoado, etc.)
 *   - Clientes churned que não pagaram naquele mês (filtro automático por status do pagamento)
 *
 * Cache: Nenhum cache próprio. Quem chama define o revalidate.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface ReceitaMes {
  mes: string;
  receita: number;
  fonte: "pagamentos" | "config_mensal";
}

/**
 * Calcula a receita efetiva para um único mês.
 * @param supabase - Cliente Supabase com service role
 * @param mes - Mês no formato "YYYY-MM"
 * @returns ReceitaMes com valor e fonte usada
 */
export async function getReceitaMes(
  supabase: SupabaseClient,
  mes: string
): Promise<ReceitaMes> {
  const mesRef = `${mes}-01`;

  // 1. Buscar pagamentos efetivos
  const { data: pagamentos } = await supabase
    .from("pagamentos_mensais")
    .select("valor_pago")
    .eq("mes_referencia", mesRef)
    .eq("status", "pago");

  const somaPagamentos = (pagamentos || []).reduce(
    (s, p) => s + Number(p.valor_pago || 0),
    0
  );

  // 2. Verificar override de config_mensal (valor conferido da planilha)
  const { data: cfg } = await supabase
    .from("config_mensal")
    .select("receita_realizada")
    .eq("mes_referencia", mes)
    .maybeSingle();

  const receitaRealizada = cfg?.receita_realizada;
  if (receitaRealizada && receitaRealizada > 0) {
    return { mes, receita: receitaRealizada, fonte: "config_mensal" };
  }

  return { mes, receita: somaPagamentos, fonte: "pagamentos" };
}

/**
 * Calcula a receita efetiva para múltiplos meses em paralelo.
 * Otimizado: faz 2 queries totais (pagamentos batch + config batch) em vez de N+1.
 *
 * @param supabase - Cliente Supabase com service role
 * @param meses - Array de meses no formato "YYYY-MM"
 * @returns Array de ReceitaMes na mesma ordem dos meses de entrada
 */
export async function getReceitaMeses(
  supabase: SupabaseClient,
  meses: string[]
): Promise<ReceitaMes[]> {
  const mesRefs = meses.map((m) => `${m}-01`);

  // Batch: buscar todos os pagamentos e configs de uma vez
  const [{ data: pagamentos }, { data: configs }] = await Promise.all([
    supabase
      .from("pagamentos_mensais")
      .select("mes_referencia, valor_pago")
      .in("mes_referencia", mesRefs)
      .eq("status", "pago"),
    supabase
      .from("config_mensal")
      .select("mes_referencia, receita_realizada")
      .in("mes_referencia", meses)
      .not("receita_realizada", "is", null),
  ]);

  // Agrupar pagamentos por mês
  const pagPorMes: Record<string, number> = {};
  for (const p of pagamentos || []) {
    const m = (p.mes_referencia as string).slice(0, 7);
    pagPorMes[m] = (pagPorMes[m] || 0) + Number(p.valor_pago || 0);
  }

  // Indexar configs
  const cfgMap = new Map(
    (configs || []).map((c: { mes_referencia: string; receita_realizada: number }) => [
      c.mes_referencia,
      c.receita_realizada,
    ])
  );

  return meses.map((mes) => {
    const realizada = cfgMap.get(mes);
    if (realizada && realizada > 0) {
      return { mes, receita: realizada, fonte: "config_mensal" as const };
    }
    return { mes, receita: pagPorMes[mes] || 0, fonte: "pagamentos" as const };
  });
}
