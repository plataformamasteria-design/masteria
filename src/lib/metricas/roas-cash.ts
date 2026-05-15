/**
 * ROAS Cash Comarka — formula oficial.
 *
 * ROAS = SUM(contratos.valor_entrada no mes, status ativo)
 *      / SUM(ads_performance.spend no mes)
 *
 * Mede: "O cash de entrada de novos contratos cobriu o investimento em midia?"
 */
import { supabase } from "@/lib/supabase";
import { getInvestimentoMensal } from "./investimento";

export interface RoasCashResult {
  roas_cash: number | null;
  entradas_novos_contratos: number;
  investimento_midia: number;
  detalhes: {
    contratos_novos: number;
    fonte_entradas: "contratos.valor_entrada";
    fonte_investimento: "ads_performance";
  };
}

/**
 * Calcula ROAS Cash para um mes (YYYY-MM).
 */
export async function getRoasCashMensal(mesReferencia: string): Promise<RoasCashResult> {
  // 1. Entradas de novos contratos no mes
  const { data: contratos } = await supabase
    .from("contratos")
    .select("valor_entrada")
    .eq("mes_referencia", mesReferencia)
    .eq("status", "ativo");

  const cts = contratos || [];
  const entradas = cts.reduce((s, c) => s + Number(c.valor_entrada || 0), 0);

  // 2. Investimento via ads_performance (SSOT)
  const invest = await getInvestimentoMensal(mesReferencia);

  // 3. ROAS
  const roas = invest.valor > 0 ? entradas / invest.valor : null;

  return {
    roas_cash: roas,
    entradas_novos_contratos: entradas,
    investimento_midia: invest.valor,
    detalhes: {
      contratos_novos: cts.length,
      fonte_entradas: "contratos.valor_entrada",
      fonte_investimento: "ads_performance",
    },
  };
}
