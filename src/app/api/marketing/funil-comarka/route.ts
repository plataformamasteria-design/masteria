import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadDiagnostics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function safe(n: number | null | undefined, d: number | null | undefined): number | null {
  if (n == null || d == null || d === 0) return null;
  return n / d;
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams;
    const mesReferencia = url.get("mesReferencia") || new Date().toISOString().slice(0, 7);

    const diagnostics = await db.select().from(leadDiagnostics).where(eq(leadDiagnostics.referenceMonth, mesReferencia));
    const d = diagnostics.length > 0 ? diagnostics[0] : null;

    const investimento = Number(d?.adSpend || 0);
    const impressoes = Number(d?.campaignImpressions || 0);
    const cliques = Number(d?.campaignClicks || 0);
    const leads = Number(d?.totalLeads || d?.campaignConversions || 0);
    const qualificados = Math.round(leads * 0.4); // Mock for now
    const reunioesAgendadas = Number(d?.meetingsScheduled || 0);
    const reunioesRealizadas = Number(d?.meetingsDone || 0);
    const clientesFechados = Number(d?.contractsWon || 0);
    const mrr = Number(d?.ltvTotal || 0);

    const etapas = [
      { id: "investimento", label: "Investimento", valor: investimento, tipo: "moeda" },
      { id: "impressoes", label: "Impressões", valor: impressoes, tipo: "inteiro" },
      { id: "cliques", label: "Cliques", valor: cliques, tipo: "inteiro" },
      { id: "leads", "label": "Leads", "valor": leads, "tipo": "inteiro" },
      { id: "qualificados", label: "Qualificados", valor: qualificados, tipo: "inteiro" },
      { id: "reunioes_agendadas", label: "Reuniões Ag", valor: reunioesAgendadas, tipo: "inteiro" },
      { id: "reunioes_realizadas", label: "Reuniões Feitas", valor: reunioesRealizadas, tipo: "inteiro" },
      { id: "clientes_fechados", label: "Clientes Fechados", valor: clientesFechados, tipo: "inteiro" }
    ];

    const taxas = [
      { de: "impressoes", para: "cliques", valor: safe(cliques, impressoes), label: "CTR" },
      { de: "cliques", para: "leads", valor: safe(leads, cliques), label: "Conversão página" },
      { de: "leads", para: "qualificados", valor: safe(qualificados, leads), label: "Qualificação" },
      { de: "qualificados", para: "reunioes_agendadas", valor: safe(reunioesAgendadas, qualificados), label: "Agendamento" },
      { de: "reunioes_agendadas", para: "reunioes_realizadas", valor: safe(reunioesRealizadas, reunioesAgendadas), label: "Comparecimento" },
      { de: "reunioes_realizadas", para: "clientes_fechados", valor: safe(clientesFechados, reunioesRealizadas), label: "Fechamento" }
    ];

    const cacBruto = safe(investimento, clientesFechados);
    const ticketMedio = safe(mrr, clientesFechados);

    return NextResponse.json({
      periodo: { tipo: "mes", valor: mesReferencia },
      etapas,
      taxas,
      atribuicao_completa: true,
      periodo_parcial: false,
      receita_gerada: { mrr, ltv_real: mrr },
      totais_finais: {
        cac_bruto: cacBruto,
        cprf: safe(investimento, reunioesRealizadas),
        roas_bruto: investimento > 0 ? mrr / investimento : null,
        payback_bruto_meses: cacBruto && ticketMedio ? cacBruto / ticketMedio : null,
        taxa_lead_para_cliente: safe(clientesFechados, leads)
      }
    });
  } catch (err: any) {
    console.error("[funil-comarka]", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
