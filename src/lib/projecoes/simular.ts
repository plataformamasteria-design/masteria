/**
 * simularCenario() — Recebe inputs ajustados pelos sliders,
 * completa com base e calcula KPIs derivados.
 *
 * Logica de calculo:
 * - Reunioes feitas = agendadas x (1 - no_show%)
 * - Contratos novos = reunioes feitas x taxa_conversao_closer%
 * - MRR consolidado = contratos novos x MRR medio contrato
 * - CAC total = investimento + folha + comissao
 * - CAC unitario = CAC total / contratos novos
 * - Margem = MRR medio - custo servir unitario
 * - LTV = margem x 4.3 (ltv_meses)
 * - Payback = CAC unit / margem (NULL se margem <= 0)
 * - ROAS Real = LTV / CAC unitario
 * - ROAS Cash = entradas estimadas / investimento
 * - Lucro = MRR total carteira - custo_op - CAC total
 * - Visualizacao trimestre/anual multiplica por 3/12
 */
import type { BaseSimulacao } from "./base-simulacao";

const LTV_MESES = 4.3;

export type Visualizacao = "mes" | "trimestre" | "anual";

export interface InputsSimulacao {
  // Funil
  investimento_midia?: number;
  cpl?: number;
  cprf?: number;
  reunioes_agendadas?: number;
  taxa_no_show_pct?: number;
  taxa_conversao_closer_pct?: number;
  // Custos
  salario_closers?: number;
  salario_sdr?: number;
  comissao_closers?: number;
  comissao_sdr?: number;
  // Saude
  mrr_medio_contrato?: number;
  custo_operacional_total?: number;
  custo_servir_unitario?: number;
  clientes_ativos?: number;
}

interface Derivados {
  cac_total: number;
  cac_unitario: number | null;
  margem_mensal_cliente: number;
  payback_meses: number | null;
  ltv_real: number;
  roas_real: number | null;
  roas_cash: number | null;
  faturamento: number;
  mrr_consolidado: number;
  entradas_estimadas: number;
  lucro_liquido: number;
  reunioes_feitas: number;
  contratos_novos: number;
}

interface ComparacaoItem {
  antes: number | null;
  depois: number | null;
  delta_abs: number | null;
  delta_pct: number | null;
}

export interface ResultadoSimulacao {
  inputs_aplicados: Record<string, number>;
  derivados: Derivados;
  comparacao_base: Record<string, ComparacaoItem>;
  multiplicador_visualizacao: number;
}

function mult(v: Visualizacao): number {
  if (v === "trimestre") return 3;
  if (v === "anual") return 12;
  return 1;
}

function comparar(antes: number | null, depois: number | null): ComparacaoItem {
  if (antes == null || depois == null) {
    return { antes, depois, delta_abs: null, delta_pct: null };
  }
  const delta_abs = depois - antes;
  const delta_pct = antes !== 0 ? (delta_abs / antes) * 100 : null;
  return { antes, depois, delta_abs: Math.round(delta_abs * 100) / 100, delta_pct: delta_pct != null ? Math.round(delta_pct * 100) / 100 : null };
}

export function simularCenario(
  inputs: InputsSimulacao,
  base: BaseSimulacao,
  visualizacao: Visualizacao = "mes"
): ResultadoSimulacao {
  const m = mult(visualizacao);

  // Merge: input do usuario sobrescreve base
  const inv = inputs.investimento_midia ?? base.funil.investimento_midia;
  const noShowPct = inputs.taxa_no_show_pct ?? base.funil.taxa_no_show_pct;
  const convCloserPct = inputs.taxa_conversao_closer_pct ?? base.funil.taxa_conversao_closer_pct;

  // CPL e CPRF: se fornecidos, derivam reunioes_agendadas via investimento
  const cplSimulado = inputs.cpl ?? base.funil.cpl;
  const cprfSimulado = inputs.cprf ?? base.funil.cprf;

  let reunioesAgendadas: number;
  if (inputs.reunioes_agendadas != null) {
    // Slider de reunioes agendadas tem prioridade
    reunioesAgendadas = inputs.reunioes_agendadas;
  } else if (inputs.cprf != null && cprfSimulado > 0) {
    // CPRF simulado → derivar reunioes feitas → agendadas
    const reunioesFeitas = inv / cprfSimulado;
    const noShowFactor = 1 - noShowPct / 100;
    reunioesAgendadas = noShowFactor > 0 ? reunioesFeitas / noShowFactor : base.funil.reunioes_agendadas;
  } else if (inputs.cpl != null && cplSimulado > 0) {
    // CPL simulado → derivar leads → agendadas (proporcional a base)
    const leadsProjetados = inv / cplSimulado;
    const baseLeads = base.funil.cpl > 0 ? base.funil.investimento_midia / base.funil.cpl : 1;
    const ratioAgendadas = baseLeads > 0 ? base.funil.reunioes_agendadas / baseLeads : 0;
    reunioesAgendadas = leadsProjetados * ratioAgendadas;
  } else {
    reunioesAgendadas = base.funil.reunioes_agendadas;
  }
  const salClosers = inputs.salario_closers ?? base.custo_aquisicao.salario_closers;
  const salSdr = inputs.salario_sdr ?? base.custo_aquisicao.salario_sdr;
  const comClosers = inputs.comissao_closers ?? base.custo_aquisicao.comissao_closers;
  const comSdr = inputs.comissao_sdr ?? base.custo_aquisicao.comissao_sdr;
  const mrrMedioContrato = inputs.mrr_medio_contrato ?? base.saude_financeira.mrr_medio_contrato;
  const custoOp = inputs.custo_operacional_total ?? base.saude_financeira.custo_operacional_total;
  const custoServir = inputs.custo_servir_unitario ?? base.saude_financeira.custo_servir_unitario;
  const clientesAtivos = inputs.clientes_ativos ?? base.saude_financeira.clientes_ativos;

  // Calculos do funil
  const reunioesFeitas = reunioesAgendadas * (1 - noShowPct / 100);
  const contratosNovos = reunioesFeitas * (convCloserPct / 100);

  // Financeiros
  const mrrConsolidado = contratosNovos * mrrMedioContrato;
  const entradas = mrrConsolidado; // entradas estimadas = MRR dos novos contratos
  const faturamento = clientesAtivos * mrrMedioContrato + mrrConsolidado; // carteira + novos

  // CAC
  const folha = salClosers + salSdr;
  const comissao = comClosers + comSdr;
  const cacTotal = inv + folha + comissao;
  const cacUnitario = contratosNovos > 0 ? cacTotal / contratosNovos : null;

  // Margem, LTV, Payback
  const margemMensal = mrrMedioContrato - custoServir;
  const paybackMeses = margemMensal > 0 && cacUnitario != null ? cacUnitario / margemMensal : null;
  const ltvReal = margemMensal > 0 ? margemMensal * LTV_MESES : 0;
  const roasReal = cacUnitario != null && cacUnitario > 0 ? ltvReal / cacUnitario : null;
  const roasCash = inv > 0 ? entradas / inv : null;

  // Lucro
  const lucro = mrrConsolidado + (clientesAtivos * mrrMedioContrato) - custoOp - cacTotal;

  const inputs_aplicados: Record<string, number> = {
    investimento_midia: inv,
    cpl: cplSimulado,
    cprf: cprfSimulado,
    reunioes_agendadas: reunioesAgendadas,
    taxa_no_show_pct: noShowPct,
    taxa_conversao_closer_pct: convCloserPct,
    salario_closers: salClosers,
    salario_sdr: salSdr,
    comissao_closers: comClosers,
    comissao_sdr: comSdr,
    mrr_medio_contrato: mrrMedioContrato,
    custo_operacional_total: custoOp,
    custo_servir_unitario: custoServir,
    clientes_ativos: clientesAtivos,
  };

  const derivados: Derivados = {
    cac_total: round2(cacTotal * m),
    cac_unitario: cacUnitario != null ? round2(cacUnitario) : null,
    margem_mensal_cliente: round2(margemMensal),
    payback_meses: paybackMeses != null ? round2(paybackMeses) : null,
    ltv_real: round2(ltvReal),
    roas_real: roasReal != null ? round2(roasReal) : null,
    roas_cash: roasCash != null ? round2(roasCash) : null,
    faturamento: round2(faturamento * m),
    mrr_consolidado: round2(mrrConsolidado * m),
    entradas_estimadas: round2(entradas * m),
    lucro_liquido: round2(lucro * m),
    reunioes_feitas: round2(reunioesFeitas * m),
    contratos_novos: round2(contratosNovos * m),
  };

  // Comparacao com base (sempre mensal para comparar apple-to-apple)
  const baseDerivados = base.derivados_atuais;
  const comparacao_base: Record<string, ComparacaoItem> = {
    cac_unitario: comparar(baseDerivados.cac_unitario, cacUnitario),
    margem_mensal_cliente: comparar(baseDerivados.margem_mensal_cliente, margemMensal),
    payback_meses: comparar(baseDerivados.payback_meses, paybackMeses),
    ltv_real: comparar(baseDerivados.ltv_real, ltvReal),
    roas_real: comparar(baseDerivados.roas_real, roasReal),
    roas_cash: comparar(baseDerivados.roas_cash, roasCash),
    lucro_mensal: comparar(baseDerivados.lucro_mensal_aproximado, lucro),
    contratos_novos: comparar(base.saude_financeira.contratos_novos, contratosNovos),
  };

  return {
    inputs_aplicados,
    derivados,
    comparacao_base,
    multiplicador_visualizacao: m,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
