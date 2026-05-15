import type { LancamentoDiario, ConfigMensal, Contrato, LeadCrm } from "@/types/database";

export interface KpiData {
  leads: number;
  investimento: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  noShow: number;
  percentNoShow: number;
  contratosGanhos: number;
  ltvTotal: number;
  /** Caixa total que entrou no mês (MRR + pagamentos à vista) */
  mrrTotal: number;
  /** MRR recorrente — só o que será cobrado nos próximos meses (exclui à vista) */
  mrrRecorrente: number;
  entradaTotal: number;
  comissoesTotal: number;
  custoLead: number;
  percentLeadsReuniao: number;
  custoReuniaoFeita: number;
  percentLeadsContrato: number;
  cacMarketing: number;
  cacAproximado: number;
  ticketMedio: number;
  roas: number;
  resultadoTime: number;
  mql: number;
  sql: number;
  taxaMql: number;
}

export function calcKpis(
  lancamentos: LancamentoDiario[],
  config: ConfigMensal | null,
  opts?: { contratos?: Contrato[]; crmLeads?: LeadCrm[]; metaSpend?: number; metaLeads?: number; isPeriodoMes?: boolean; mqlSqlConfig?: { mql: string[]; sql: string[] } }
): KpiData {
  // Leads: CRM a partir de abril/2026, config_mensal para meses anteriores, Meta como último fallback
  // IMPORTANTE: config?.leads_totais é SEMPRE o total do mês, não respeita filtro dia/semana.
  // Quando o período não é "mes", não usar config como fallback.
  const mesRef = config?.mes_referencia || "";
  const hasCrmLeads = mesRef >= "2026-04" && opts?.crmLeads != null;
  const leads = hasCrmLeads
    ? opts!.crmLeads!.length
    : (opts?.isPeriodoMes !== false ? (config?.leads_totais || opts?.metaLeads || 0) : (opts?.metaLeads || 0));
  const investimento = opts?.metaSpend != null ? opts.metaSpend : (opts?.isPeriodoMes !== false ? Number(config?.investimento ?? 0) : 0);

  // Funil — vem de lancamentos_diarios (fonte primária de atividade)
  const reunioesAgendadas = lancamentos.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const reunioesFeitas = lancamentos.reduce((s, l) => s + l.reunioes_feitas, 0);
  // No-show: usar o MAIOR entre explícito e calculado (agendadas - feitas)
  const noShowExplicito = lancamentos.reduce((s, l) => s + (l.no_show || 0), 0);
  const noShowCalculado = Math.max(0, reunioesAgendadas - reunioesFeitas);
  const noShow = Math.max(noShowExplicito, noShowCalculado);

  // Contratos ativos (status === "ativo")
  const contratosAtivos = (opts?.contratos || []).filter(
    (c) => c.status === "ativo"
  );

  // Mapa de contratos ativos por ID para lookup rápido
  const contratosById = new Map(contratosAtivos.map((c) => [c.id, c]));

  // === CONTRATOS GANHOS ===
  // CRM leads "comprou" somente quando hasCrmLeads (>= abril/2026)
  // Antes disso CRM tinha leads "comprou" sem contrato real (inflava a contagem)
  const leadsComprou = hasCrmLeads
    ? (opts?.crmLeads?.filter((l) => l.etapa === "comprou") || [])
    : [];
  const contratosGanhos = leadsComprou.length > 0 ? leadsComprou.length : contratosAtivos.length;

  // === FINANCEIRO ===
  // Se há CRM leads válidos: dados do contrato vinculado (fallback para lead)
  // Senão: contratos ativos diretamente
  let mrrTotal = 0;
  let mrrRecorrente = 0; // Exclui contratos à vista (mensalidades_variaveis)
  let ltvTotal = 0;
  let entradaTotal = 0;

  if (leadsComprou.length > 0) {
    for (const l of leadsComprou) {
      const c = l.contrato_id ? contratosById.get(l.contrato_id) : undefined;
      // Usar contrato.mrr se > 0, senão fallback para lead.mensalidade
      const mrr = Number(c?.mrr || l.mensalidade || 0);
      const varMensal = ((c as any)?.mensalidades_variaveis ?? (l as any).mensalidades_variaveis ?? null) as number[] | null;
      const isRecorrente = !varMensal || varMensal.length === 0;
      let ltv: number;
      if (varMensal && varMensal.length > 0) {
        ltv = varMensal.reduce((sum, v) => sum + (v || 0), 0);
      } else {
        ltv = Number(l.valor_total_projeto ?? c?.valor_total_projeto ?? 0);
      }
      // Entrada: preferir contrato (fonte confiável, preenchido pelo financeiro)
      const entrada = Number(c?.valor_entrada ?? l.valor_entrada ?? 0);
      mrrTotal += mrr;
      if (isRecorrente) mrrRecorrente += mrr;
      ltvTotal += ltv;
      entradaTotal += entrada;
    }
  } else {
    for (const c of contratosAtivos) {
      const mrr = Number(c.mrr || 0);
      const varMensal = (c as any).mensalidades_variaveis as number[] | null;
      const isRecorrente = !varMensal || varMensal.length === 0;
      mrrTotal += mrr;
      if (isRecorrente) mrrRecorrente += mrr;
      if (varMensal && varMensal.length > 0) {
        ltvTotal += varMensal.reduce((sum: number, v: number) => sum + (v || 0), 0);
      } else {
        ltvTotal += Number(c.valor_total_projeto || 0);
        entradaTotal += Number(c.valor_entrada || 0);
      }
    }
  }

  // === COMISSÃO ===
  // 10% do MRR dos contratos ativos
  const comissoesTotal = mrrTotal * 0.1;

  // === CAIXA ===
  // Caixa real que entrou no mês = soma das entradas (primeira mensalidade)
  // Para quem entrada_e_primeiro_mes=true: caixa = entrada (que já é o 1º mês)
  // Para quem entrada != mrr: caixa = entrada
  const caixaContratosNovos = contratosAtivos
    ? contratosAtivos.reduce((s, c) => {
        const varMensal = (c as any).mensalidades_variaveis as number[] | null;
        if (varMensal && varMensal.length > 0) {
          // Caixa do mês = primeira mensalidade variável
          return s + (varMensal[0] || 0);
        }
        const ent = Number(c.valor_entrada || 0);
        const mrr = Number(c.mrr || 0);
        const primeiro = (c as Contrato).entrada_e_primeiro_mes ?? true;
        return s + (primeiro ? ent : ent + mrr);
      }, 0)
    : entradaTotal;

  // === TICKET MÉDIO ===
  const ticketMedio = contratosGanhos > 0 ? mrrTotal / contratosGanhos : 0;

  // === MQL / SQL (soma de todos os canais) ===
  // Etapas MQL/SQL via config_funil_etapas (consistente com /marketing/visao-geral)
  const mqlEtapas = opts?.mqlSqlConfig?.mql ?? ["qualificado", "reuniao_agendada", "proposta_enviada", "assinatura_contrato"];
  const sqlEtapas = opts?.mqlSqlConfig?.sql ?? ["reuniao_agendada", "proposta_enviada", "assinatura_contrato"];

  const crmArr = opts?.crmLeads || [];
  const mql = crmArr.filter((l) => mqlEtapas.includes(l.etapa)).length;
  const sql = crmArr.filter((l) => sqlEtapas.includes(l.etapa)).length;
  const taxaMql = leads > 0 ? (mql / leads) * 100 : 0;

  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    leads,
    investimento,
    reunioesAgendadas,
    reunioesFeitas,
    noShow,
    percentNoShow: safe(noShow, reunioesAgendadas) * 100,
    contratosGanhos,
    ltvTotal,
    mrrTotal,
    mrrRecorrente,
    entradaTotal,
    comissoesTotal,
    custoLead: safe(investimento, leads),
    percentLeadsReuniao: safe(reunioesFeitas, leads) * 100,
    custoReuniaoFeita: safe(investimento, reunioesFeitas),
    percentLeadsContrato: safe(contratosGanhos, leads) * 100,
    cacMarketing: safe(investimento, contratosGanhos),
    cacAproximado: safe(investimento + comissoesTotal, contratosGanhos),
    ticketMedio,
    roas: safe(entradaTotal, investimento),
    resultadoTime: caixaContratosNovos - (comissoesTotal + investimento),
    mql,
    sql,
    taxaMql,
  };
}

export function trend(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
}

