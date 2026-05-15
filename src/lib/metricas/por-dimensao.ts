/**
 * getMetricasPorDimensao() — Atribuicao proporcional ao spend para
 * metricas de funil por dimensao demografica (localizacao, idade,
 * dispositivo, plataforma, posicionamento).
 *
 * NAO cria formulas novas. Consome totais de getMetricasPorEntidade()
 * e distribui proporcionalmente ao spend de cada segmento.
 *
 * Matriz de permissao (quais metricas cada dimensao pode exibir):
 * - localizacao, dispositivo, plataforma: TODAS
 * - idade_genero, posicionamento: somente qualificados + reunioes
 *   (contratos/MRR/CAC/ROAS ficam null — amostra fragmenta)
 */

import { getMetricasPorEntidade } from "./por-entidade";

export type DimensaoBreakdown =
  | "region"
  | "age_gender"
  | "device"
  | "platform"
  | "placement";

/** Entrada: row vinda da Meta API com metricas de trafego */
export interface DemographicRowInput {
  label: string;
  sublabel?: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpc: number;
}

/** Saida: row enriquecida com metricas de funil estimadas */
export interface DemographicRowEnriched extends DemographicRowInput {
  qualificados_est: number;
  taxa_qualificacao_est: number | null;
  reunioes_realizadas_est: number;
  contratos_est: number | null;
  mrr_gerado_est: number | null;
  cac_est: number | null;
  roas_cash_est: number | null;
  estimado: true;
}

export interface MetricasPorDimensaoResult {
  itens: DemographicRowEnriched[];
  totais: {
    investimento: number;
    leads: number;
    qualificados: number;
    reunioes_realizadas: number;
    contratos_novos: number;
    mrr_gerado: number;
    valor_entrada: number;
  };
  metodologia: "atribuicao_proporcional_ao_spend";
  fonte_funil: "getMetricasPorEntidade (vw_atribuicao_lead_mes + contratos)";
  permite_contratos: boolean;
}

// Dimensoes com metricas completas (contratos, MRR, CAC, ROAS)
const DIMENSOES_FULL: DimensaoBreakdown[] = ["region", "device", "platform"];

export async function getMetricasPorDimensao(params: {
  dimensao: DimensaoBreakdown;
  mesReferencia?: string;
  dataInicio?: string;
  dataFim?: string;
  demographicRows: DemographicRowInput[];
}): Promise<MetricasPorDimensaoResult> {
  const { dimensao, demographicRows } = params;
  const permiteContratos = DIMENSOES_FULL.includes(dimensao);

  // 1. Buscar totais agregados via funcao canonica existente (range ou mes)
  const result = params.dataInicio && params.dataFim
    ? await getMetricasPorEntidade({
        nivel: "campaign",
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        status: "todos",
      })
    : await getMetricasPorEntidade({
        nivel: "campaign",
        mesReferencia: params.mesReferencia!,
        status: "todos",
      });
  const totais = result.totais;

  // 2. Calcular spend total dos segmentos demograficos
  const spendTotal = demographicRows.reduce((s, r) => s + r.spend, 0);

  // 3. Para cada segmento, distribuir proporcionalmente
  const itens: DemographicRowEnriched[] = demographicRows.map((row) => {
    const ratio = spendTotal > 0 ? row.spend / spendTotal : 0;

    // Qualificados e reunioes: sempre permitidos
    const qualificadosEst = Math.round(totais.qualificados * ratio);
    const reunioesEst = Math.round(totais.reunioes_realizadas * ratio);
    const leadsForTaxa = row.leads > 0 ? row.leads : Math.round(totais.leads * ratio);
    const taxaQualificacaoEst =
      leadsForTaxa > 0 ? (qualificadosEst / leadsForTaxa) * 100 : null;

    // Contratos, MRR, CAC, ROAS: somente se a dimensao permite
    let contratosEst: number | null = null;
    let mrrGeradoEst: number | null = null;
    let cacEst: number | null = null;
    let roasCashEst: number | null = null;

    if (permiteContratos) {
      contratosEst = Math.round(totais.contratos_novos * ratio);
      mrrGeradoEst = totais.mrr_gerado * ratio;
      cacEst = contratosEst > 0 ? row.spend / contratosEst : null;
      // ROAS Cash: (valor_entrada proporcional) / spend do segmento
      const valorEntrada = totais.roas_cash != null && totais.investimento > 0
        ? totais.roas_cash * totais.investimento * ratio
        : 0;
      roasCashEst = row.spend > 0 && valorEntrada > 0 ? valorEntrada / row.spend : null;
    }

    return {
      ...row,
      qualificados_est: qualificadosEst,
      taxa_qualificacao_est: taxaQualificacaoEst,
      reunioes_realizadas_est: reunioesEst,
      contratos_est: contratosEst,
      mrr_gerado_est: mrrGeradoEst,
      cac_est: cacEst,
      roas_cash_est: roasCashEst,
      estimado: true as const,
    };
  });

  // Calcular valor_entrada total para referencia
  const valorEntradaTotal =
    totais.roas_cash != null && totais.investimento > 0
      ? totais.roas_cash * totais.investimento
      : 0;

  return {
    itens,
    totais: {
      investimento: totais.investimento,
      leads: totais.leads,
      qualificados: totais.qualificados,
      reunioes_realizadas: totais.reunioes_realizadas,
      contratos_novos: totais.contratos_novos,
      mrr_gerado: totais.mrr_gerado,
      valor_entrada: valorEntradaTotal,
    },
    metodologia: "atribuicao_proporcional_ao_spend",
    fonte_funil: "getMetricasPorEntidade (vw_atribuicao_lead_mes + contratos)",
    permite_contratos: permiteContratos,
  };
}
