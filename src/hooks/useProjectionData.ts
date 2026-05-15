"use client";
import { useEffect, useState, useMemo } from "react";

interface MetaSummary { spend: number; leads: number; cpl: number; ctr: number; frequency: number; budgetMonthly: number }
interface CrmSummary { totalLeads: number; qualifiedLeads: number; scheduledMeetings: number; completedMeetings: number; noShowCount: number; closedDeals: number; avgResponseTimeMinutes: number; taxaQualificacao: number; taxaAgendamento: number; taxaNoShow: number; taxaFechamento: number }
interface DashSummary { ticketMedio: number; metaMensalSalva: number | null; investimento: number; leadsTotais: number }

export interface HistData {
  mes: string; leads: number; investimento: number; reunioesAgendadas: number;
  reunioesFeitas: number; noShow: number; contratos: number; mrr: number;
  ltv: number; ticketMedio: number; cpl: number; taxaNoShow: number;
  taxaFechamento: number; taxaLeadReuniao: number;
}

export interface Alert {
  id: string;
  categoria: "orcamento" | "criativo" | "crm" | "funil";
  severidade: "critico" | "atencao" | "ok";
  titulo: string;
  descricao: string;
}

export interface HistoricalAverages {
  ticketMedio: number;
  taxaLeadReuniao: number;     // % de leads que viram reunião feita (direto)
  taxaReuniaoFechamento: number; // % de reuniões feitas que viram contrato (direto)
  taxaAgendamento: number;     // % de leads que viram reunião agendada
  taxaNoShow: number;
  cpl: number;
  cac: number;                  // custo por aquisição de cliente
  custoPorReuniao: number;      // investimento / reuniões feitas
  mrrMedio: number;             // MRR médio fechado por mês
  investimentoMedio: number;    // Investimento médio mensal (Meta API)
  leadsMedio: number;           // Leads médios por mês
  reunioesMarcadasMedio: number;
  reunioesFeitasMedio: number;
  contratosMedio: number;       // Contratos médios por mês
  mesesComDados: number;        // Quantos meses efetivamente têm dados
}

export interface FinancialGoals {
  metaMRR: number;
  faturamentoLTV: number;
  entrada: number;
  metaContratos: number;
}

export interface MetricOverrides {
  ticketMedio: number | null;       // null = histórico, 0 = desativado
  taxaLeadReuniao: number | null;
  taxaReuniaoFechamento: number | null;
  taxaNoShow: number | null;
  cpl: number | null;
  cac: number | null;
}

export type HistPeriod = 1 | 3 | 6 | 12 | "all";

export function useProjectionData(goals: FinancialGoals, overrides: MetricOverrides, histPeriod: HistPeriod = 3) {
  const [metaData, setMetaData] = useState<MetaSummary | null>(null);
  const [crmData, setCrmData] = useState<CrmSummary | null>(null);
  const [dashData, setDashData] = useState<DashSummary | null>(null);
  const [allMeses, setAllMeses] = useState<(HistData | null)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    fetch("/api/projections/summary", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setMetaData(data.meta);
        setCrmData(data.crm);
        setDashData(data.dash);
        if (data.meses) setAllMeses(data.meses);
        if (data.error) setError(data.error);
      })
      .catch((e) => {
        if (e?.name === "AbortError") {
          setError("Timeout ao carregar dados. Tente novamente.");
        } else {
          setError(String(e));
        }
      })
      .finally(() => { clearTimeout(timeoutId); setIsLoading(false); });
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  // Historical averages — using DIRECT observed rates, based on selected period
  const histAvg = useMemo((): HistoricalAverages => {
    const months = (histPeriod === "all" ? allMeses : allMeses.slice(0, histPeriod)).filter(Boolean) as HistData[];
    const n = months.length;

    if (n === 0) {
      return {
        ticketMedio: 1800,
        taxaLeadReuniao: 0.08,
        taxaReuniaoFechamento: 0.25,
        taxaAgendamento: 0.15,
        taxaNoShow: 0.20,
        cpl: 50,
        cac: 2500,
        custoPorReuniao: 625,
        mrrMedio: 0,
        investimentoMedio: 0,
        leadsMedio: 0,
        reunioesMarcadasMedio: 0,
        reunioesFeitasMedio: 0,
        contratosMedio: 0,
        mesesComDados: 0,
      };
    }

    const avg = (fn: (m: HistData) => number) => {
      const vals = months.map(fn).filter((v) => v > 0);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    };

    // Totals for weighted calculations
    const totalLeads = months.reduce((s, m) => s + m.leads, 0);
    const totalSpend = months.reduce((s, m) => s + m.investimento, 0);
    const totalMarcadas = months.reduce((s, m) => s + m.reunioesAgendadas, 0);
    const totalFeitas = months.reduce((s, m) => s + m.reunioesFeitas, 0);
    const totalContratos = months.reduce((s, m) => s + m.contratos, 0);
    const totalMrr = months.reduce((s, m) => s + m.mrr, 0);
    const totalLtv = months.reduce((s, m) => s + m.ltv, 0);

    // Weighted rates (ponderado, não média simples)
    const taxaLeadReuniao = totalLeads > 0 ? totalFeitas / totalLeads : 0.08;
    const taxaReuniaoFechamento = totalFeitas > 0 ? totalContratos / totalFeitas : 0.25;
    const taxaAgendamento = totalLeads > 0 ? totalMarcadas / totalLeads : 0.15;
    const taxaNoShow = totalMarcadas > 0 ? (totalMarcadas - totalFeitas) / totalMarcadas : 0.20;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 50;
    const cac = totalContratos > 0 ? totalSpend / totalContratos : 2500;
    const custoPorReuniao = totalFeitas > 0 ? totalSpend / totalFeitas : 625;
    const ticketMedio = totalContratos > 0 ? totalMrr / totalContratos : (avg((m) => m.ticketMedio) || 1800);

    return {
      ticketMedio,
      taxaLeadReuniao,
      taxaReuniaoFechamento,
      taxaAgendamento,
      taxaNoShow,
      cpl,
      cac,
      custoPorReuniao,
      mrrMedio: n > 0 ? totalMrr / n : 0,
      investimentoMedio: n > 0 ? totalSpend / n : 0,
      leadsMedio: n > 0 ? totalLeads / n : 0,
      reunioesMarcadasMedio: n > 0 ? totalMarcadas / n : 0,
      reunioesFeitasMedio: n > 0 ? totalFeitas / n : 0,
      contratosMedio: n > 0 ? totalContratos / n : 0,
      mesesComDados: n,
    };
  }, [allMeses, histPeriod]);

  // Effective values: override > historical average (0 = desativado, treated as historical)
  const effective = useMemo(() => {
    const use = (override: number | null, fallback: number) =>
      override !== null && override > 0 ? override : fallback;
    return {
      ticketMedio: use(overrides.ticketMedio, histAvg.ticketMedio),
      taxaLeadReuniao: use(overrides.taxaLeadReuniao, histAvg.taxaLeadReuniao),
      taxaReuniaoFechamento: use(overrides.taxaReuniaoFechamento, histAvg.taxaReuniaoFechamento),
      taxaAgendamento: histAvg.taxaAgendamento,
      taxaNoShow: use(overrides.taxaNoShow, histAvg.taxaNoShow),
      cpl: use(overrides.cpl, histAvg.cpl),
      cac: use(overrides.cac, histAvg.cac),
      custoPorReuniao: histAvg.custoPorReuniao,
    };
  }, [overrides, histAvg]);

  // Reverse projection: simplified 3-step funnel + CAC cross-check
  const projection = useMemo(() => {
    const { metaMRR, faturamentoLTV, entrada, metaContratos } = goals;
    const { ticketMedio, taxaLeadReuniao, taxaReuniaoFechamento, taxaNoShow, cpl, cac } = effective;

    // Step 1: How many clients?
    const clientesExatos = metaContratos > 0
      ? metaContratos
      : (ticketMedio > 0 ? metaMRR / ticketMedio : 0);
    const clientesNecessarios = Math.ceil(clientesExatos);

    // Step 2: How many meetings needed? (reunião feita → fechamento)
    const reunioesExatas = taxaReuniaoFechamento > 0 ? clientesExatos / taxaReuniaoFechamento : 0;
    const reunioesNecessarias = Math.ceil(reunioesExatas);

    // Agendamentos = reuniões / (1 - no-show) para ter as reuniões feitas
    const agendamentosExatos = (1 - taxaNoShow) > 0 ? reunioesExatas / (1 - taxaNoShow) : reunioesExatas;
    const agendamentosNecessarios = Math.ceil(agendamentosExatos);

    // Step 3: How many leads? (lead → reunião feita, taxa direta observada)
    const leadsExatos = taxaLeadReuniao > 0 ? reunioesExatas / taxaLeadReuniao : 0;
    const leadsNecessarios = Math.ceil(leadsExatos);

    // Budget via CPL
    const budgetViaCPL = Math.round(leadsNecessarios * cpl * 100) / 100;

    // Budget via CAC (cross-check)
    const budgetViaCAC = Math.round(clientesNecessarios * cac * 100) / 100;

    // Use o menor como referência realista (CAC é observado direto)
    const budgetNecessario = Math.min(budgetViaCPL, budgetViaCAC);

    // Forward projections
    const mrrProjetado = clientesNecessarios * ticketMedio;
    const faturamentoProjetado = faturamentoLTV;
    const entradaProjetada = entrada;
    const faturamentoPorCliente = clientesNecessarios > 0 ? faturamentoLTV / clientesNecessarios : 0;
    const entradaPorCliente = clientesNecessarios > 0 ? entrada / clientesNecessarios : 0;
    const reunioesPerdidas = agendamentosNecessarios - reunioesNecessarias;

    // Custo por reunião feita projetado (CPRF)
    const custoPorReuniaoProj = reunioesNecessarias > 0 ? budgetViaCPL / reunioesNecessarias : 0;

    // CPL projetado (deve bater com histórico)
    const cplProjetado = leadsNecessarios > 0 ? budgetViaCPL / leadsNecessarios : 0;

    return {
      clientesExatos,
      clientesNecessarios,
      reunioesNecessarias,
      agendamentosNecessarios,
      leadsNecessarios,
      budgetViaCPL,
      budgetViaCAC,
      budgetNecessario,
      mrrProjetado,
      faturamentoProjetado,
      entradaProjetada,
      reunioesPerdidas,
      faturamentoPorCliente,
      entradaPorCliente,
      custoPorReuniaoProj,
      cplProjetado,
    };
  }, [goals, effective]);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (metaData) {
      if (metaData.frequency > 5) list.push({ id: "freq-crit", categoria: "criativo", severidade: "critico", titulo: "Frequência crítica", descricao: `Frequência de ${metaData.frequency.toFixed(1)}x — audiência saturada. Rotacione criativos urgentemente.` });
      else if (metaData.frequency > 3.5) list.push({ id: "freq-attn", categoria: "criativo", severidade: "atencao", titulo: "Frequência alta", descricao: `Frequência de ${metaData.frequency.toFixed(1)}x — próximo do limite. Considere novos criativos.` });

      if (metaData.ctr < 0.8) list.push({ id: "ctr-crit", categoria: "criativo", severidade: "critico", titulo: "CTR muito baixo", descricao: `CTR de ${metaData.ctr.toFixed(2)}% — criativos não estão gerando cliques. Revise copywriting e visuais.` });
      else if (metaData.ctr < 1.2) list.push({ id: "ctr-attn", categoria: "criativo", severidade: "atencao", titulo: "CTR abaixo do ideal", descricao: `CTR de ${metaData.ctr.toFixed(2)}% — ideal acima de 1.5%. Teste novos formatos.` });

      if (metaData.cpl > 80) list.push({ id: "cpl-attn", categoria: "criativo", severidade: "atencao", titulo: "CPL elevado", descricao: `CPL de R$ ${fmt(metaData.cpl)} — acima do benchmark de R$ 70. Otimize segmentação e criativos.` });
    }

    if (crmData) {
      if (crmData.taxaNoShow > 0.4) list.push({ id: "noshow-crit", categoria: "crm", severidade: "critico", titulo: "No-show crítico", descricao: `Taxa de no-show de ${(crmData.taxaNoShow * 100).toFixed(0)}% — quase metade das reuniões são perdidas. Implemente confirmação 24h antes.` });
      else if (crmData.taxaNoShow > 0.25) list.push({ id: "noshow-attn", categoria: "crm", severidade: "atencao", titulo: "No-show alto", descricao: `Taxa de no-show de ${(crmData.taxaNoShow * 100).toFixed(0)}% — ideal abaixo de 20%.` });

      if (crmData.avgResponseTimeMinutes > 60) list.push({ id: "resp-crit", categoria: "crm", severidade: "critico", titulo: "Tempo de resposta lento", descricao: `Tempo médio de ${crmData.avgResponseTimeMinutes} minutos — leads esfriam. Ideal: < 15 minutos.` });
    }

    // Cross-check: se CPL e CAC divergem muito, alertar
    if (projection.budgetViaCPL > 0 && projection.budgetViaCAC > 0) {
      const diff = Math.abs(projection.budgetViaCPL - projection.budgetViaCAC);
      const pct = diff / Math.max(projection.budgetViaCPL, projection.budgetViaCAC) * 100;
      if (pct > 30) {
        list.push({ id: "budget-diverge", categoria: "funil", severidade: "atencao", titulo: "CPL e CAC divergem", descricao: `Budget via CPL: R$ ${fmt(projection.budgetViaCPL)} vs via CAC: R$ ${fmt(projection.budgetViaCAC)} (${pct.toFixed(0)}% de diferença). O CAC histórico sugere investimento de R$ ${fmt(projection.budgetViaCAC)}.` });
      }
    }

    const sevOrder = { critico: 0, atencao: 1, ok: 2 } as const;
    list.sort((a, b) => (sevOrder[a.severidade] ?? 2) - (sevOrder[b.severidade] ?? 2));

    return list;
  }, [metaData, crmData, projection]);

  // All months with data, oldest first (for table display)
  const histMeses = useMemo(() => {
    return allMeses.filter(Boolean).reverse() as HistData[];
  }, [allMeses]);

  return { metaData, crmData, dashData, allMeses, histMeses, histAvg, effective, projection, alerts, isLoading, error, retry };
}
