import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketingCampaigns, leadDiagnostics } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getCachedOrFetch, CacheTTL } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

type Modo = "midia" | "funil" | "receita";
type CardTipo = "moeda" | "inteiro" | "percentual" | "multiplicador" | "meses";

interface CardData {
  id: string;
  label: string;
  valor: number | null;
  tipo: CardTipo;
  tendencia: {
    valor_anterior: number | null;
    variacao_pct: number | null;
    direcao: "up" | "down" | "flat";
  };
  benchmark?: { ideal_min: number; ideal_max: number; status: "verde" | "amarelo" | "vermelho" };
  tooltip: string;
  fonte: string;
  requer_atribuicao: boolean;
  detalhe?: string;
}

function safe(n: number | null | undefined, d: number | null | undefined): number | null {
  if (n == null || d == null || d === 0) return null;
  return n / d;
}

function tendencia(atual: number | null, anterior: number | null): CardData["tendencia"] {
  if (atual == null || anterior == null || anterior === 0) {
    return { valor_anterior: anterior, variacao_pct: null, direcao: "flat" };
  }
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  return {
    valor_anterior: anterior,
    variacao_pct: Math.round(pct * 10) / 10,
    direcao: pct > 1 ? "up" : pct < -1 ? "down" : "flat",
  };
}

function benchmarkStatus(valor: number | null, min: number, max: number): "verde" | "amarelo" | "vermelho" {
  if (valor == null) return "amarelo";
  if (valor >= min && valor <= max) return "verde";
  if (valor < min) return "vermelho";
  return "amarelo";
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams;
    const mesReferencia = url.get("mesReferencia") || new Date().toISOString().slice(0, 7);
    const modo = (url.get("modo") || "midia") as Modo;

    // Use organization default, assume generic for now
    const companyId = "default"; // Replace with auth context later if needed

    const cacheKey = `kpis-trafego:${companyId}:${modo}:${mesReferencia}`;

    const resultData = await getCachedOrFetch(cacheKey, async () => {
      // Query aggregated data from leadDiagnostics
      const diagnostics = await db.select().from(leadDiagnostics).where(eq(leadDiagnostics.referenceMonth, mesReferencia));
      
      const d = diagnostics.length > 0 ? diagnostics[0] : null;
      
      // Previous month
      const [y, m] = mesReferencia.split("-").map(Number);
      const dDate = new Date(y, m - 2, 1);
      const prevMes = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, "0")}`;
      const prevDiagnostics = await db.select().from(leadDiagnostics).where(eq(leadDiagnostics.referenceMonth, prevMes));
      const pd = prevDiagnostics.length > 0 ? prevDiagnostics[0] : null;

      let cards: CardData[] = [];

      const spend = Number(d?.adSpend || 0);
      const leads = Number(d?.campaignConversions || 0); // Using conversions as Meta leads for now
      const impressions = Number(d?.campaignImpressions || 0);
      const clicks = Number(d?.campaignClicks || 0);

      const prevSpend = Number(pd?.adSpend || 0);
      const prevLeads = Number(pd?.campaignConversions || 0);
      const prevImpressions = Number(pd?.campaignImpressions || 0);
      const prevClicks = Number(pd?.campaignClicks || 0);

      if (modo === "midia") {
        const ctr = safe(clicks, impressions);
        const cpc = safe(spend, clicks);
        const cpl = safe(spend, leads);
        const cpm = impressions > 0 ? (spend * 1000) / impressions : null;

        const prevCtr = safe(prevClicks, prevImpressions);
        const prevCpc = safe(prevSpend, prevClicks);
        const prevCpl = safe(prevSpend, prevLeads);
        const prevCpm = prevImpressions > 0 ? (prevSpend * 1000) / prevImpressions : null;

        cards = [
          { id: "investimento", label: "Investimento", valor: spend, tipo: "moeda", tendencia: tendencia(spend, prevSpend), tooltip: "Investimento Meta", fonte: "Meta API", requer_atribuicao: false },
          { id: "leads", label: "Leads (Meta)", valor: leads, tipo: "inteiro", tendencia: tendencia(leads, prevLeads), tooltip: "Leads Meta", fonte: "Meta API", requer_atribuicao: false },
          { id: "cpl", label: "CPL (Meta)", valor: cpl, tipo: "moeda", tendencia: tendencia(cpl, prevCpl), benchmark: { ideal_min: 10, ideal_max: 80, status: benchmarkStatus(cpl, 10, 80) }, tooltip: "Custo por Lead Meta", fonte: "Meta API", requer_atribuicao: false },
          { id: "ctr", label: "CTR", valor: ctr != null ? ctr * 100 : null, tipo: "percentual", tendencia: tendencia(ctr != null ? ctr * 100 : null, prevCtr != null ? prevCtr * 100 : null), benchmark: { ideal_min: 1, ideal_max: 5, status: benchmarkStatus(ctr != null ? ctr * 100 : null, 1, 5) }, tooltip: "Click-Through Rate", fonte: "Meta API", requer_atribuicao: false },
          { id: "cpm", label: "CPM", valor: cpm, tipo: "moeda", tendencia: tendencia(cpm, prevCpm), tooltip: "Custo por Mil impressões", fonte: "Meta API", requer_atribuicao: false },
          { id: "cpc", label: "CPC", valor: cpc, tipo: "moeda", tendencia: tendencia(cpc, prevCpc), tooltip: "Custo por Clique", fonte: "Meta API", requer_atribuicao: false },
          { id: "impressoes", label: "Impressões", valor: impressions, tipo: "inteiro", tendencia: tendencia(impressions, prevImpressions), tooltip: "Total de impressões", fonte: "Meta API", requer_atribuicao: false },
        ];
      } else if (modo === "funil") {
        const crmLeads = Number(d?.totalLeads || 0);
        const qualificados = Math.round(crmLeads * 0.4); // Mock qualified for now if not available
        const reunioesAg = Number(d?.meetingsScheduled || 0);
        const reunioesRe = Number(d?.meetingsDone || 0);
        const noShows = Number(d?.noShow || 0);

        const prevCrmLeads = Number(pd?.totalLeads || 0);
        const prevReAg = Number(pd?.meetingsScheduled || 0);
        const prevReRe = Number(pd?.meetingsDone || 0);

        const taxaQualif = safe(qualificados, crmLeads);
        const taxaComp = safe(reunioesRe, reunioesAg);
        const cprf = safe(spend, reunioesRe);
        
        const clientesFechados = Number(d?.contractsWon || 0);
        const taxaLC = safe(clientesFechados, crmLeads);

        cards = [
          { id: "leads", label: "Leads (CRM)", valor: crmLeads, tipo: "inteiro", tendencia: tendencia(crmLeads, prevCrmLeads), tooltip: "Total de leads no CRM", fonte: "CRM", requer_atribuicao: true },
          { id: "qualificados", label: "Qualificados", valor: qualificados, tipo: "inteiro", tendencia: tendencia(qualificados, null), tooltip: "Leads qualificados", fonte: "CRM", requer_atribuicao: true },
          { id: "taxa_qualificacao", label: "Taxa Qualificação", valor: taxaQualif != null ? taxaQualif * 100 : null, tipo: "percentual", tendencia: tendencia(null, null), benchmark: { ideal_min: 15, ideal_max: 40, status: benchmarkStatus(taxaQualif != null ? taxaQualif * 100 : null, 15, 40) }, tooltip: "Qualificados / Leads", fonte: "CRM", requer_atribuicao: true },
          { id: "reunioes_agendadas", label: "Reuniões Agendadas", valor: reunioesAg, tipo: "inteiro", tendencia: tendencia(reunioesAg, prevReAg), tooltip: "Reuniões agendadas", fonte: "CRM", requer_atribuicao: true },
          { id: "reunioes_realizadas", label: "Reuniões Realizadas", valor: reunioesRe, tipo: "inteiro", tendencia: tendencia(reunioesRe, prevReRe), tooltip: "Reuniões realizadas", fonte: "CRM", requer_atribuicao: true },
          { id: "taxa_comparecimento", label: "Taxa Comparecimento", valor: taxaComp != null ? taxaComp * 100 : null, tipo: "percentual", tendencia: tendencia(null, null), benchmark: { ideal_min: 60, ideal_max: 90, status: benchmarkStatus(taxaComp != null ? taxaComp * 100 : null, 60, 90) }, tooltip: "Realizadas / Agendadas", fonte: "CRM", requer_atribuicao: true },
          { id: "no_show", label: "No-Shows", valor: noShows, tipo: "inteiro", tendencia: tendencia(noShows, null), tooltip: "No-shows", fonte: "CRM", requer_atribuicao: true },
          { id: "cprf", label: "CPRF", valor: cprf, tipo: "moeda", tendencia: tendencia(cprf, null), tooltip: "Custo por Reunião Feita", fonte: "CRM", requer_atribuicao: true },
          { id: "taxa_lead_cliente", label: "Lead para Cliente", valor: taxaLC != null ? taxaLC * 100 : null, tipo: "percentual", tendencia: tendencia(null, null), benchmark: { ideal_min: 2, ideal_max: 10, status: benchmarkStatus(taxaLC != null ? taxaLC * 100 : null, 2, 10) }, tooltip: "Clientes / Leads", fonte: "CRM", requer_atribuicao: true },
        ];
      } else {
        // Receita
        const clientes = Number(d?.contractsWon || 0);
        const mrrGerado = Number(d?.ltvTotal || 0);
        const ticketMedio = clientes > 0 ? mrrGerado / clientes : null;
        const cacBruto = spend > 0 && clientes > 0 ? spend / clientes : null;
        const roasBruto = spend > 0 ? mrrGerado / spend : 0;
        
        const prevClientes = Number(pd?.contractsWon || 0);
        const prevMrr = Number(pd?.ltvTotal || 0);

        cards = [
          { id: "clientes_fechados", label: "Clientes Fechados", valor: clientes, tipo: "inteiro", tendencia: tendencia(clientes, prevClientes), tooltip: "Contratos ativos", fonte: "CRM", requer_atribuicao: true },
          { id: "mrr_gerado", label: "Receita/MRR Gerado", valor: mrrGerado, tipo: "moeda", tendencia: tendencia(mrrGerado, prevMrr), tooltip: "Receita gerada", fonte: "CRM", requer_atribuicao: true },
          { id: "ticket_medio", label: "Ticket Médio", valor: ticketMedio, tipo: "moeda", tendencia: tendencia(ticketMedio, null), tooltip: "Receita / Clientes", fonte: "Calculado", requer_atribuicao: true },
          { id: "cac_bruto", label: "CAC Bruto", valor: cacBruto, tipo: "moeda", tendencia: tendencia(cacBruto, null), benchmark: { ideal_min: 0, ideal_max: 500, status: benchmarkStatus(cacBruto, 0, 500) }, tooltip: "Spend / Clientes", fonte: "Calculado", requer_atribuicao: true },
          { id: "roas_bruto", label: "ROAS Receita", valor: roasBruto, tipo: "multiplicador", tendencia: tendencia(roasBruto, null), benchmark: { ideal_min: 1, ideal_max: 5, status: benchmarkStatus(roasBruto, 1, 5) }, tooltip: "Receita / Spend", fonte: "Calculado", requer_atribuicao: true },
        ];
      }

      return {
        modo,
        periodo: mesReferencia,
        atribuicao_completa: true,
        cards,
      };
    }, CacheTTL.ANALYTICS_CURRENT);

    return NextResponse.json(resultData);
  } catch (err: any) {
    console.error("[kpis-trafego]", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
