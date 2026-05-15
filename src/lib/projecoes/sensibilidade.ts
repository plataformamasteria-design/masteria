/**
 * calcularSensibilidade() — Para cada slider, calcula o delta no lucro
 * liquido se a alavanca variar +10% e -10% (mantendo as outras fixas).
 *
 * Retorna array ordenado por impacto decrescente (ranking).
 */
import type { BaseSimulacao } from "./base-simulacao";
import { simularCenario, type Visualizacao } from "./simular";

interface SensibilidadeItem {
  alavanca: string;
  label: string;
  valor_base: number;
  delta_lucro_pos_10pct: number;
  delta_lucro_neg_10pct: number;
  impacto_absoluto: number;
  ranking: number;
}

const ALAVANCAS: { key: string; label: string; getValue: (b: BaseSimulacao) => number; inverso?: boolean }[] = [
  { key: "investimento_midia", label: "Investimento Midia", getValue: (b) => b.funil.investimento_midia },
  { key: "cpl", label: "CPL", getValue: (b) => b.funil.cpl, inverso: true },
  { key: "cprf", label: "CPRF", getValue: (b) => b.funil.cprf, inverso: true },
  { key: "reunioes_agendadas", label: "Reuniões Agendadas", getValue: (b) => b.funil.reunioes_agendadas },
  { key: "taxa_no_show_pct", label: "Taxa No-Show", getValue: (b) => b.funil.taxa_no_show_pct },
  { key: "taxa_conversao_closer_pct", label: "Taxa Conversão Closer", getValue: (b) => b.funil.taxa_conversao_closer_pct },
  { key: "salario_closers", label: "Salário Closers", getValue: (b) => b.custo_aquisicao.salario_closers },
  { key: "salario_sdr", label: "Salário SDR", getValue: (b) => b.custo_aquisicao.salario_sdr },
  { key: "comissao_closers", label: "Comissão Closers", getValue: (b) => b.custo_aquisicao.comissao_closers },
  { key: "comissao_sdr", label: "Comissão SDR", getValue: (b) => b.custo_aquisicao.comissao_sdr },
  { key: "mrr_medio_contrato", label: "MRR Médio Contrato", getValue: (b) => b.saude_financeira.mrr_medio_contrato },
  { key: "custo_operacional_total", label: "Custo Operacional", getValue: (b) => b.saude_financeira.custo_operacional_total },
  { key: "custo_servir_unitario", label: "Custo Servir Unitario", getValue: (b) => b.saude_financeira.custo_servir_unitario },
];

export function calcularSensibilidade(
  base: BaseSimulacao,
  visualizacao: Visualizacao = "mes"
): SensibilidadeItem[] {
  // Lucro base (sem ajustes)
  const resultBase = simularCenario({}, base, visualizacao);
  const lucroBase = resultBase.derivados.lucro_liquido;

  const items: SensibilidadeItem[] = [];

  // Helper: para CPL/CPRF, traduzir variacao em reunioes_agendadas
  function cplToReunioesAgendadas(cpl: number): number {
    const inv = base.funil.investimento_midia;
    const baseLeads = inv / base.funil.cpl;
    const ratioAgendadas = baseLeads > 0 ? base.funil.reunioes_agendadas / baseLeads : 0;
    const leads = cpl > 0 ? inv / cpl : baseLeads;
    return leads * ratioAgendadas;
  }

  function cprfToReunioesAgendadas(cprf: number): number {
    const inv = base.funil.investimento_midia;
    const feitas = cprf > 0 ? inv / cprf : base.funil.reunioes_feitas;
    const noShowFactor = 1 - base.funil.taxa_no_show_pct / 100;
    return noShowFactor > 0 ? feitas / noShowFactor : base.funil.reunioes_agendadas;
  }

  for (const alavanca of ALAVANCAS) {
    const valorBase = alavanca.getValue(base);
    if (valorBase === 0) {
      items.push({
        alavanca: alavanca.key,
        label: alavanca.label,
        valor_base: 0,
        delta_lucro_pos_10pct: 0,
        delta_lucro_neg_10pct: 0,
        impacto_absoluto: 0,
        ranking: 0,
      });
      continue;
    }

    let inputPos: Record<string, number>;
    let inputNeg: Record<string, number>;

    if (alavanca.key === "cpl") {
      // CPL -10% = mais leads = mais reunioes (positivo)
      inputPos = { reunioes_agendadas: cplToReunioesAgendadas(valorBase * 0.9) };
      inputNeg = { reunioes_agendadas: cplToReunioesAgendadas(valorBase * 1.1) };
    } else if (alavanca.key === "cprf") {
      // CPRF -10% = mais reunioes feitas (positivo)
      inputPos = { reunioes_agendadas: cprfToReunioesAgendadas(valorBase * 0.9) };
      inputNeg = { reunioes_agendadas: cprfToReunioesAgendadas(valorBase * 1.1) };
    } else {
      inputPos = { [alavanca.key]: valorBase * 1.1 };
      inputNeg = { [alavanca.key]: valorBase * 0.9 };
    }

    const resultPos = simularCenario(inputPos, base, visualizacao);
    const deltaPos = resultPos.derivados.lucro_liquido - lucroBase;

    const resultNeg = simularCenario(inputNeg, base, visualizacao);
    const deltaNeg = resultNeg.derivados.lucro_liquido - lucroBase;

    // Para CPL/CPRF inversos: -10% CPL = positivo, so swap labels
    const finalDeltaPos = alavanca.inverso ? deltaNeg : deltaPos;
    const finalDeltaNeg = alavanca.inverso ? deltaPos : deltaNeg;

    items.push({
      alavanca: alavanca.key,
      label: alavanca.label,
      valor_base: Math.round(valorBase * 100) / 100,
      delta_lucro_pos_10pct: Math.round(finalDeltaPos * 100) / 100,
      delta_lucro_neg_10pct: Math.round(finalDeltaNeg * 100) / 100,
      impacto_absoluto: Math.round((Math.abs(finalDeltaPos) + Math.abs(finalDeltaNeg)) * 100) / 100,
      ranking: 0,
    });
  }

  // Ordenar por impacto absoluto decrescente e atribuir ranking
  items.sort((a, b) => b.impacto_absoluto - a.impacto_absoluto);
  items.forEach((item, i) => { item.ranking = i + 1; });

  return items;
}
