/**
 * getMetricasPorEntidade() — Funcao canonica para metricas estrategicas
 * por campanha, conjunto ou anuncio.
 *
 * Fontes consumidas (nenhuma logica nova de calculo):
 * - ads_performance + ads_metadata: investimento, status
 * - vw_atribuicao_lead_mes: leads, qualificados, reunioes, contratos, MRR
 * - clientes_receita.ltv_meses: LTV medio (4.3)
 * - getRoasCashMensal: referencia para ROAS Cash agregado
 *
 * Regras:
 * - CAC exclui contratos de Lucas (closer diretor) — id a987d655-88d0-490b-ad73-efe04843a2ec
 * - ATRIBUICAO_INICIO_DATA = 2026-04-03. Antes: atribuicao_completa = false
 * - Divisor = 0 → null
 */
import { supabase } from "@/lib/supabase";
import { ATRIBUICAO_INICIO_DATA } from "@/lib/atribuicao";
import { getConfigMqlSql } from "@/lib/metricas/mql-sql";

// Lucas (closer diretor) NAO entra em CAC
const CLOSER_EXCLUIR_CAC = "a987d655-88d0-490b-ad73-efe04843a2ec";

export interface MetricaEntidade {
  id: string;
  nome: string;
  status: "ativo" | "pausado";
  parent_id?: string;
  investimento: number;
  leads: number;
  cpl: number | null;
  qualificados: number;
  taxa_qualificacao_pct: number | null;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  no_show_pct: number | null;
  contratos_novos: number;
  mrr_gerado: number;
  ltv_real: number;
  cac: number | null;
  cprf: number | null;
  taxa_fechamento_pct: number | null;
  roas_cash: number | null;
  roas_real: number | null;
  mql: number;
  sql: number;
  taxa_mql_pct: number | null;
  taxa_sql_pct: number | null;
  custo_mql: number | null;
  custo_sql: number | null;
  atribuicao_completa: boolean;
}

export interface MetricasPorEntidadeResult {
  itens: MetricaEntidade[];
  totais: Omit<MetricaEntidade, "id" | "nome" | "status" | "parent_id">;
  fonte: {
    investimento: string;
    qualificacao: string;
    reunioes: string;
    contratos: string;
  };
  mqlSqlConfig: { mql: string[]; sql: string[] };
}

export async function getMetricasPorEntidade(params: {
  nivel: "campaign" | "adset" | "ad";
  mesReferencia?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: "ativo" | "pausado" | "todos";
  spendMinimo?: number;
}): Promise<MetricasPorEntidadeResult> {
  const { nivel, status = "todos", spendMinimo = 0 } = params;

  // Suportar range de datas OU mes unico (backward compat)
  let startDate: string;
  let endDate: string;
  let mesesReferencia: string[];

  if (params.dataInicio && params.dataFim) {
    startDate = params.dataInicio;
    endDate = params.dataFim;
    // Gerar lista de meses cobertos pelo range (para queries de atribuicao)
    mesesReferencia = [];
    const cur = new Date(startDate + "T00:00:00");
    const fim = new Date(endDate + "T00:00:00");
    while (cur <= fim) {
      mesesReferencia.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const mesReferencia = params.mesReferencia!;
    startDate = `${mesReferencia}-01`;
    const [y, m] = mesReferencia.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    endDate = `${mesReferencia}-${String(lastDay).padStart(2, "0")}`;
    mesesReferencia = [mesReferencia];
  }

  // Atribuicao disponivel?
  const mesCorte = ATRIBUICAO_INICIO_DATA.slice(0, 7); // "2026-04"
  const atribuicaoCompleta = mesesReferencia.every(m => m >= mesCorte);

  // MQL/SQL config (cache 5min)
  const mqlSqlConfig = await getConfigMqlSql();

  // LTV medio
  const LTV_MESES = 4.3;

  // 1. Buscar ads_performance + ads_metadata do mes
  const { data: perfRows } = await supabase
    .from("ads_performance")
    .select("ad_id, spend, leads, ads_metadata!inner(ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, status)")
    .gte("data_ref", startDate)
    .lte("data_ref", endDate)
    .limit(10000);

  const rows = (perfRows || []) as unknown as Array<{
    ad_id: string;
    spend: number;
    leads: number;
    ads_metadata: {
      ad_id: string;
      ad_name: string | null;
      adset_id: string | null;
      adset_name: string | null;
      campaign_id: string | null;
      campaign_name: string | null;
      status: string | null;
    };
  }>;

  // 2. Buscar dados de atribuicao (leads, reunioes, contratos) do periodo
  const { data: attrRows } = await supabase
    .from("vw_atribuicao_lead_mes")
    .select("lead_id, ad_id, adset_id, campanha_id, foi_qualificado, teve_reuniao_agendada, teve_reuniao_realizada, foi_no_show, virou_cliente, mrr_gerado, closer_id")
    .in("mes_lead", mesesReferencia);

  const leads = (attrRows || []) as Array<{
    lead_id: string;
    ad_id: string | null;
    adset_id: string | null;
    campanha_id: string | null;
    foi_qualificado: boolean;
    teve_reuniao_agendada: boolean;
    teve_reuniao_realizada: boolean;
    foi_no_show: boolean;
    virou_cliente: boolean;
    mrr_gerado: number | null;
    closer_id: string | null;
  }>;

  // 3. Buscar contratos com valor_entrada para ROAS Cash
  const { data: contratosRows } = await supabase
    .from("contratos")
    .select("id, lead_id, valor_entrada, closer_id")
    .in("mes_referencia", mesesReferencia)
    .eq("status", "ativo");

  const contratos = (contratosRows || []) as Array<{
    id: string;
    lead_id: string | null;
    valor_entrada: number | null;
    closer_id: string | null;
  }>;

  // 3b. Buscar contrato_id e etapa dos leads para vinculo bidirecional + MQL/SQL
  const { data: leadContratoRows } = await supabase
    .from("leads_crm")
    .select("id, contrato_id, etapa, ad_id, adset_id, campaign_id")
    .in("mes_referencia", mesesReferencia);

  // Mapa lead_id → etapa para MQL/SQL classification
  const leadEtapaMap = new Map<string, string>();
  for (const lc of (leadContratoRows || []) as Array<{ id: string; contrato_id: string | null; etapa: string | null; ad_id: string | null; adset_id: string | null; campaign_id: string | null }>) {
    if (lc.etapa) leadEtapaMap.set(lc.id, lc.etapa);
  }

  const leadToContratoId = new Map<string, string>();
  for (const lc of (leadContratoRows || []) as Array<{ id: string; contrato_id: string | null }>) {
    if (!lc.contrato_id) continue;
    leadToContratoId.set(lc.id, lc.contrato_id);
  }

  // Map contrato.id → contrato (para lookup reverso)
  const contratoById = new Map<string, typeof contratos[0]>();
  for (const c of contratos) {
    contratoById.set(c.id, c);
  }

  // Map lead_id → contrato (bidirecional: via contrato.lead_id OU leads_crm.contrato_id)
  const contratoByLeadId = new Map<string, typeof contratos[0]>();
  // Sentido 1: contrato.lead_id → contrato
  for (const c of contratos) {
    if (c.lead_id) contratoByLeadId.set(c.lead_id, c);
  }
  // Sentido 2: leads_crm.contrato_id → contrato (fallback para contratos sem lead_id)
  for (const [leadId, contratoId] of leadToContratoId) {
    if (!contratoByLeadId.has(leadId)) {
      const contrato = contratoById.get(contratoId);
      if (contrato) contratoByLeadId.set(leadId, contrato);
    }
  }

  // 4. Agregar por entidade
  type EntityKey = string;
  interface EntityAgg {
    id: string;
    nome: string;
    metaStatus: string;
    parent_id?: string;
    spend: number;
    metaLeads: number;
    leadsAttr: typeof leads;
  }

  const entityMap = new Map<EntityKey, EntityAgg>();

  // Helper to get entity key from a row
  function getEntityKey(meta: typeof rows[0]["ads_metadata"]): { key: string; nome: string; parent_id?: string } {
    switch (nivel) {
      case "campaign":
        return { key: meta.campaign_id || "sem_campanha", nome: meta.campaign_name || meta.campaign_id || "Sem campanha" };
      case "adset":
        return { key: meta.adset_id || "sem_conjunto", nome: meta.adset_name || meta.adset_id || "Sem conjunto", parent_id: meta.campaign_id || undefined };
      case "ad":
        return { key: meta.ad_id, nome: meta.ad_name || meta.ad_id, parent_id: meta.adset_id || undefined };
    }
  }

  // Aggregate spend from performance
  for (const row of rows) {
    const meta = row.ads_metadata;
    const { key, nome, parent_id } = getEntityKey(meta);
    let entity = entityMap.get(key);
    if (!entity) {
      entity = { id: key, nome, metaStatus: meta.status || "", parent_id, spend: 0, metaLeads: 0, leadsAttr: [] };
      entityMap.set(key, entity);
    }
    entity.spend += Number(row.spend || 0);
    entity.metaLeads += Number(row.leads || 0);
  }

  // Aggregate leads attribution
  for (const lead of leads) {
    let key: string | null = null;
    switch (nivel) {
      case "campaign": key = lead.campanha_id; break;
      case "adset": key = lead.adset_id; break;
      case "ad": key = lead.ad_id; break;
    }
    if (!key) continue;
    const entity = entityMap.get(key);
    if (entity) {
      entity.leadsAttr.push(lead);
    }
  }

  // 5. Compute metrics per entity
  const itens: MetricaEntidade[] = [];

  for (const entity of entityMap.values()) {
    const investimento = entity.spend;

    // Status: ativo se spend > 0 no mes OU status atual = ACTIVE
    const isActive = investimento > 0 || entity.metaStatus === "ACTIVE";
    const entityStatus: "ativo" | "pausado" = isActive ? "ativo" : "pausado";

    // Filter by status if requested
    if (status === "ativo" && entityStatus !== "ativo") continue;
    if (status === "pausado" && entityStatus !== "pausado") continue;

    // Filter by spend minimo
    if (investimento < spendMinimo) continue;

    const leadsCount = entity.leadsAttr.length;
    const cpl = leadsCount > 0 ? investimento / leadsCount : null;

    const qualificados = entity.leadsAttr.filter(l => l.foi_qualificado).length;
    const taxaQualificacaoPct = leadsCount > 0 ? (qualificados / leadsCount) * 100 : null;

    const reunioesAgendadas = entity.leadsAttr.filter(l => l.teve_reuniao_agendada).length;
    const reunioesRealizadas = entity.leadsAttr.filter(l => l.teve_reuniao_realizada).length;
    const noShowCount = entity.leadsAttr.filter(l => l.foi_no_show).length;
    const noShowPct = reunioesAgendadas > 0 ? (noShowCount / reunioesAgendadas) * 100 : null;

    // Contratos: excluindo Lucas do CAC
    const clienteLeads = entity.leadsAttr.filter(l => l.virou_cliente);
    const contratosNovos = clienteLeads.length;
    const mrrGerado = clienteLeads.reduce((s, l) => s + Number(l.mrr_gerado || 0), 0);
    const ltvReal = mrrGerado * LTV_MESES;

    // CAC: excluir contratos de Lucas
    const contratosParaCac = clienteLeads.filter(l => l.closer_id !== CLOSER_EXCLUIR_CAC).length;
    const cac = contratosParaCac > 0 ? investimento / contratosParaCac : null;

    // ROAS Cash: valor_entrada dos contratos vinculados a leads desta entidade
    let valorEntradaTotal = 0;
    for (const cl of clienteLeads) {
      const contrato = contratoByLeadId.get(cl.lead_id);
      if (contrato) {
        valorEntradaTotal += Number(contrato.valor_entrada || 0);
      }
    }
    const roasCash = investimento > 0 ? valorEntradaTotal / investimento : null;

    // ROAS Real (LTV): ltv / investimento
    const roasReal = investimento > 0 ? ltvReal / investimento : null;

    // CPRF: Custo Por Reunião Feita
    const cprf = reunioesRealizadas > 0 ? investimento / reunioesRealizadas : null;

    // Taxa de Fechamento: contratos / leads × 100
    const taxaFechamentoPct = leadsCount > 0 ? (contratosNovos / leadsCount) * 100 : null;

    // MQL/SQL: classificação por etapa do lead no CRM
    let mqlCount = 0;
    let sqlCount = 0;
    for (const l of entity.leadsAttr) {
      const etapa = leadEtapaMap.get(l.lead_id);
      if (etapa) {
        if (mqlSqlConfig.mql.includes(etapa)) mqlCount++;
        if (mqlSqlConfig.sql.includes(etapa)) sqlCount++;
      }
    }
    const taxaMqlPct = leadsCount > 0 ? (mqlCount / leadsCount) * 100 : null;
    const taxaSqlPct = leadsCount > 0 ? (sqlCount / leadsCount) * 100 : null;
    const custoMql = mqlCount > 0 ? investimento / mqlCount : null;
    const custoSql = sqlCount > 0 ? investimento / sqlCount : null;

    itens.push({
      id: entity.id,
      nome: entity.nome,
      status: entityStatus,
      parent_id: entity.parent_id,
      investimento,
      leads: leadsCount,
      cpl,
      qualificados,
      taxa_qualificacao_pct: taxaQualificacaoPct,
      reunioes_agendadas: reunioesAgendadas,
      reunioes_realizadas: reunioesRealizadas,
      no_show_pct: noShowPct,
      contratos_novos: contratosNovos,
      mrr_gerado: mrrGerado,
      ltv_real: ltvReal,
      cac,
      cprf,
      taxa_fechamento_pct: taxaFechamentoPct,
      roas_cash: roasCash,
      roas_real: roasReal,
      mql: mqlCount,
      sql: sqlCount,
      taxa_mql_pct: taxaMqlPct,
      taxa_sql_pct: taxaSqlPct,
      custo_mql: custoMql,
      custo_sql: custoSql,
      atribuicao_completa: atribuicaoCompleta,
    });
  }

  // Sort by investimento desc
  itens.sort((a, b) => b.investimento - a.investimento);

  // 6. Compute totals
  const totalInvestimento = itens.reduce((s, i) => s + i.investimento, 0);
  const totalLeads = itens.reduce((s, i) => s + i.leads, 0);
  const totalQualificados = itens.reduce((s, i) => s + i.qualificados, 0);
  const totalReunioesAgendadas = itens.reduce((s, i) => s + i.reunioes_agendadas, 0);
  const totalReunioesRealizadas = itens.reduce((s, i) => s + i.reunioes_realizadas, 0);
  const totalContratosNovos = itens.reduce((s, i) => s + i.contratos_novos, 0);
  const totalMrrGerado = itens.reduce((s, i) => s + i.mrr_gerado, 0);
  const totalLtvReal = totalMrrGerado * LTV_MESES;
  const totalNoShowCount = itens.reduce((s, i) => {
    if (i.no_show_pct !== null && i.reunioes_agendadas > 0) {
      return s + Math.round(i.no_show_pct * i.reunioes_agendadas / 100);
    }
    return s;
  }, 0);

  // CAC total: excluindo Lucas
  const allClienteLeads = leads.filter(l => l.virou_cliente && l.closer_id !== CLOSER_EXCLUIR_CAC);
  const totalContratosParaCac = allClienteLeads.length;
  const totalCac = totalContratosParaCac > 0 ? totalInvestimento / totalContratosParaCac : null;

  // ROAS Cash total
  let totalValorEntrada = 0;
  for (const cl of leads.filter(l => l.virou_cliente)) {
    const contrato = contratoByLeadId.get(cl.lead_id);
    if (contrato) totalValorEntrada += Number(contrato.valor_entrada || 0);
  }
  const totalRoasCash = totalInvestimento > 0 ? totalValorEntrada / totalInvestimento : null;
  const totalRoasReal = totalInvestimento > 0 ? totalLtvReal / totalInvestimento : null;
  const totalCprf = totalReunioesRealizadas > 0 ? totalInvestimento / totalReunioesRealizadas : null;
  const totalTaxaFechamentoPct = totalLeads > 0 ? (totalContratosNovos / totalLeads) * 100 : null;

  return {
    itens,
    totais: {
      investimento: totalInvestimento,
      leads: totalLeads,
      cpl: totalLeads > 0 ? totalInvestimento / totalLeads : null,
      qualificados: totalQualificados,
      taxa_qualificacao_pct: totalLeads > 0 ? (totalQualificados / totalLeads) * 100 : null,
      reunioes_agendadas: totalReunioesAgendadas,
      reunioes_realizadas: totalReunioesRealizadas,
      no_show_pct: totalReunioesAgendadas > 0 ? (totalNoShowCount / totalReunioesAgendadas) * 100 : null,
      contratos_novos: totalContratosNovos,
      mrr_gerado: totalMrrGerado,
      ltv_real: totalLtvReal,
      cac: totalCac,
      cprf: totalCprf,
      taxa_fechamento_pct: totalTaxaFechamentoPct,
      roas_cash: totalRoasCash,
      roas_real: totalRoasReal,
      mql: itens.reduce((s, i) => s + i.mql, 0),
      sql: itens.reduce((s, i) => s + i.sql, 0),
      taxa_mql_pct: totalLeads > 0 ? (itens.reduce((s, i) => s + i.mql, 0) / totalLeads) * 100 : null,
      taxa_sql_pct: totalLeads > 0 ? (itens.reduce((s, i) => s + i.sql, 0) / totalLeads) * 100 : null,
      custo_mql: itens.reduce((s, i) => s + i.mql, 0) > 0 ? totalInvestimento / itens.reduce((s, i) => s + i.mql, 0) : null,
      custo_sql: itens.reduce((s, i) => s + i.sql, 0) > 0 ? totalInvestimento / itens.reduce((s, i) => s + i.sql, 0) : null,
      atribuicao_completa: atribuicaoCompleta,
    },
    fonte: {
      investimento: "ads_performance.spend",
      qualificacao: "vw_atribuicao_lead_mes.foi_qualificado",
      reunioes: "vw_atribuicao_lead_mes (teve_reuniao_agendada/realizada)",
      contratos: "vw_atribuicao_lead_mes + contratos.valor_entrada",
    },
    mqlSqlConfig: { mql: mqlSqlConfig.mql, sql: mqlSqlConfig.sql },
  };
}
