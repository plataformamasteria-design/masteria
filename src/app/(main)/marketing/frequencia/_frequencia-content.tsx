"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Clock, Calendar, BarChart3, Lightbulb } from "lucide-react";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const DIAS_FULL = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`);

type HeatmapMode = "leads" | "qualificados" | "cpl";

interface InsightData {
  melhorHorario: string;
  melhorDia: string;
  eficiencia: string;
  insight: string;
}

function InsightCard({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon size={14} className="text-muted-foreground/60" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        <p className="text-xs leading-relaxed">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function TrafegoFrequenciaPage() {
  const filters = usePeriodoTrafego();
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<HeatmapMode>("leads");

  // Leads qualificados e spend por hora (para modos qualificados e CPL)
  const [qualLeads, setQualLeads] = useState<LeadAdsAttribution[]>([]);
  const [spendByHour, setSpendByHour] = useState<Map<string, number>>(new Map());

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim]);

  async function loadData() {
    setLoading(true);

    // Parallel: leads + qualificados + spend
    const [leadsRes, qualRes, spendRes] = await Promise.all([
      supabase.from("leads_ads_attribution")
        .select("hora_chegada,dia_semana")
        .gte("created_at", filters.dataInicio + "T00:00:00")
        .lte("created_at", filters.dataFim + "T23:59:59"),
      supabase.from("leads_crm")
        .select("ghl_created_at, etapa")
        .gte("ghl_created_at", filters.dataInicio + "T00:00:00")
        .lte("ghl_created_at", filters.dataFim + "T23:59:59")
        .in("etapa", ["qualificado", "reuniao_agendada", "reuniao_realizada", "proposta", "comprou"]),
      supabase.from("ads_performance")
        .select("data_ref, spend")
        .gte("data_ref", filters.dataInicio)
        .lte("data_ref", filters.dataFim),
    ]);

    setLeads((leadsRes.data || []) as LeadAdsAttribution[]);

    // Build qualificados by hour
    const qLeads = (qualRes.data || []).map((l: any) => {
      const dt = new Date(l.ghl_created_at);
      return { ...l, dia_semana: dt.getDay(), hora_chegada: dt.getHours() };
    });
    setQualLeads(qLeads as LeadAdsAttribution[]);

    // Build total spend (for CPL calculation)
    const totalSpend = (spendRes.data || []).reduce((s: number, r: any) => s + Number(r.spend || 0), 0);
    const totalLeads = (leadsRes.data || []).length;
    // Distribute spend proportionally per lead-hour cell
    const spMap = new Map<string, number>();
    if (totalLeads > 0) {
      const costPerLead = totalSpend / totalLeads;
      for (const l of (leadsRes.data || []) as LeadAdsAttribution[]) {
        const key = `${l.dia_semana}-${l.hora_chegada}`;
        spMap.set(key, (spMap.get(key) || 0) + costPerLead);
      }
    }
    setSpendByHour(spMap);
    setLoading(false);
  }

  // Build grids
  const { grid, maxVal, gridQual, maxQual, gridCpl, maxCpl, minCpl } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let mx = 0;
    leads.forEach((l) => {
      if (l.dia_semana >= 0 && l.dia_semana <= 6 && l.hora_chegada >= 0 && l.hora_chegada <= 23) {
        g[l.dia_semana][l.hora_chegada]++;
        mx = Math.max(mx, g[l.dia_semana][l.hora_chegada]);
      }
    });

    const gq: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let mqual = 0;
    qualLeads.forEach((l: any) => {
      if (l.dia_semana >= 0 && l.dia_semana <= 6 && l.hora_chegada >= 0 && l.hora_chegada <= 23) {
        gq[l.dia_semana][l.hora_chegada]++;
        mqual = Math.max(mqual, gq[l.dia_semana][l.hora_chegada]);
      }
    });

    const gc: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let mcpl = 0;
    let mincpl = Infinity;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const leadsInCell = g[d][h];
        if (leadsInCell > 0) {
          const sp = spendByHour.get(`${d}-${h}`) || 0;
          const cpl = sp / leadsInCell;
          gc[d][h] = cpl;
          mcpl = Math.max(mcpl, cpl);
          mincpl = Math.min(mincpl, cpl);
        }
      }
    }

    return { grid: g, maxVal: mx, gridQual: gq, maxQual: mqual, gridCpl: gc, maxCpl: mcpl, minCpl: mincpl === Infinity ? 0 : mincpl };
  }, [leads, qualLeads, spendByHour]);

  // Insights computation
  const insights = useMemo((): InsightData => {
    if (leads.length === 0) {
      return { melhorHorario: "Sem dados", melhorDia: "Sem dados", eficiencia: "Sem dados", insight: "Sem dados suficientes" };
    }

    // 1. Best cell
    let bestDia = 0, bestHora = 0, bestVal = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > bestVal) { bestVal = grid[d][h]; bestDia = d; bestHora = h; }
      }
    }
    const melhorHorario = `${DIAS_FULL[bestDia]} as ${HORAS[bestHora]} concentra o maior volume — ${bestVal} lead${bestVal > 1 ? "s" : ""}`;

    // 2. Best day
    const dayTotals = DIAS.map((_, d) => grid[d].reduce((s, v) => s + v, 0));
    const bestDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
    const melhorDia = `${DIAS_FULL[bestDayIdx]}: maior volume de leads da semana (${dayTotals[bestDayIdx]})`;

    // 3. Efficiency: cells with leads / cells with budget (all cells since budget is always on)
    const cellsWithLeads = grid.flat().filter(v => v > 0).length;
    const totalCells = 7 * 24;
    const cobertura = ((cellsWithLeads / totalCells) * 100).toFixed(0);
    const eficiencia = `Apenas ${cobertura}% das janelas de horario geraram leads`;

    // 4. Window insight: consecutive hours with leads
    let bestWindow = "";
    for (let d = 0; d < 7; d++) {
      let start = -1, count = 0;
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > 0) {
          if (start === -1) start = h;
          count++;
        } else {
          if (count >= 2) {
            bestWindow = `${DIAS_FULL[d]} das ${HORAS[start]} as ${HORAS[start + count - 1]}: leads recorrentes`;
            break;
          }
          start = -1; count = 0;
        }
      }
      if (bestWindow) break;
      if (count >= 2 && start !== -1) {
        bestWindow = `${DIAS_FULL[d]} das ${HORAS[start]} as ${HORAS[start + count - 1]}: leads recorrentes`;
        break;
      }
    }
    const insight = bestWindow || "Nenhuma janela consecutiva identificada";

    return { melhorHorario, melhorDia, eficiencia, insight };
  }, [grid, leads]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Color functions per mode
  const getCellStyle = (di: number, hi: number) => {
    if (mode === "leads") {
      const val = grid[di][hi];
      const opacity = maxVal > 0 ? Math.max(0.05, val / maxVal) : 0;
      return {
        backgroundColor: val > 0 ? `rgba(24, 95, 165, ${opacity})` : "rgba(255,255,255,0.03)",
        color: opacity > 0.5 ? "white" : opacity > 0 ? "rgba(24, 95, 165, 0.8)" : "transparent",
      };
    }
    if (mode === "qualificados") {
      const val = gridQual[di][hi];
      const opacity = maxQual > 0 ? Math.max(0.05, val / maxQual) : 0;
      return {
        backgroundColor: val > 0 ? `rgba(34, 197, 94, ${opacity})` : "rgba(255,255,255,0.03)",
        color: opacity > 0.5 ? "white" : opacity > 0 ? "rgba(34, 197, 94, 0.8)" : "transparent",
      };
    }
    // CPL mode
    const leadsInCell = grid[di][hi];
    if (leadsInCell === 0) {
      return { backgroundColor: "rgba(255,255,255,0.03)", color: "transparent" };
    }
    const cpl = gridCpl[di][hi];
    // Green (low CPL) to Red (high CPL)
    const range = maxCpl - minCpl;
    const normalized = range > 0 ? (cpl - minCpl) / range : 0.5;
    const r = Math.round(normalized * 220 + 35);
    const g = Math.round((1 - normalized) * 180 + 35);
    return {
      backgroundColor: `rgba(${r}, ${g}, 60, 0.7)`,
      color: "white",
    };
  };

  const getCellText = (di: number, hi: number) => {
    if (mode === "leads") return grid[di][hi] > 0 ? String(grid[di][hi]) : "";
    if (mode === "qualificados") return gridQual[di][hi] > 0 ? String(gridQual[di][hi]) : "";
    const leadsInCell = grid[di][hi];
    if (leadsInCell === 0) return "";
    return formatCurrency(gridCpl[di][hi]);
  };

  const getCellTitle = (di: number, hi: number) => {
    if (mode === "leads") return `${DIAS[di]} ${HORAS[hi]}: ${grid[di][hi]} leads`;
    if (mode === "qualificados") return `${DIAS[di]} ${HORAS[hi]}: ${gridQual[di][hi]} qualificados`;
    const leadsInCell = grid[di][hi];
    if (leadsInCell === 0) return `${DIAS[di]} ${HORAS[hi]}: sem leads`;
    return `${DIAS[di]} ${HORAS[hi]}: CPL ${formatCurrency(gridCpl[di][hi])} (${leadsInCell} leads)`;
  };

  const legendColors = mode === "leads"
    ? [0.1, 0.3, 0.5, 0.7, 1].map(o => `rgba(24, 95, 165, ${o})`)
    : mode === "qualificados"
      ? [0.1, 0.3, 0.5, 0.7, 1].map(o => `rgba(34, 197, 94, ${o})`)
      : ["rgba(60, 215, 60, 0.7)", "rgba(128, 160, 60, 0.7)", "rgba(180, 120, 60, 0.7)", "rgba(220, 80, 60, 0.7)", "rgba(255, 35, 60, 0.7)"];

  const legendLabels = mode === "cpl" ? ["Menor CPL", "Maior CPL"] : ["Menos", "Mais"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold group relative cursor-help inline-flex items-center gap-2">
          Frequencia de Leads
          <span className="invisible group-hover:visible absolute left-0 top-full mt-2 z-50 w-80 p-3 text-xs font-normal text-muted-foreground bg-card border rounded-lg shadow-lg">
            Mostra em quais dias e horarios os leads chegam com mais frequencia. Use para identificar os melhores momentos para investir em anuncios e otimizar a distribuicao de orcamento ao longo da semana.
          </span>
        </h1>
      </div>

      {leads.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum lead com dados de frequencia no periodo</CardContent></Card>
      ) : (
        <>
          {/* Toggle */}
          <div className="flex items-center gap-1 bg-muted/30 dark:bg-white/[0.03] rounded-lg p-1 w-fit">
            {([
              { id: "leads" as const, label: "Leads", color: "bg-accent" },
              { id: "qualificados" as const, label: "Qualificados", color: "bg-green-500" },
              { id: "cpl" as const, label: "CPL", color: "bg-gradient-to-r from-green-500 to-destructive" },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  mode === opt.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", opt.color)} />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Heatmap */}
          <Card>
            <CardHeader><CardTitle className="text-base">Heatmap — Dia da Semana x Hora do Dia ({mode === "leads" ? "Leads" : mode === "qualificados" ? "Qualificados" : "CPL"})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto"><div className="min-w-[700px]">
                <div className="flex"><div className="w-10 shrink-0" />{HORAS.map((h) => (<div key={h} className="flex-1 text-center text-[9px] text-muted-foreground py-1">{h}</div>))}</div>
                {DIAS.map((dia, di) => (
                  <div key={dia} className="flex">
                    <div className="w-10 shrink-0 text-xs text-muted-foreground flex items-center justify-end pr-2">{dia}</div>
                    {Array.from({ length: 24 }, (_, hi) => (
                      <div
                        key={hi}
                        className="flex-1 aspect-square m-[1px] rounded-sm flex items-center justify-center text-[9px] font-medium"
                        style={getCellStyle(di, hi)}
                        title={getCellTitle(di, hi)}
                      >
                        {mode === "cpl" ? "" : getCellText(di, hi)}
                      </div>
                    ))}
                  </div>
                ))}
              </div></div>
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                <span>{legendLabels[0]}</span>
                {legendColors.map((c, i) => (<div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />))}
                <span>{legendLabels[1]}</span>
              </div>
            </CardContent>
          </Card>

          {/* Insights cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard icon={Clock} title="Melhor Horario" value={insights.melhorHorario} />
            <InsightCard icon={Calendar} title="Melhor Dia" value={insights.melhorDia} />
            <InsightCard icon={BarChart3} title="Eficiencia" value={insights.eficiencia} />
            <InsightCard icon={Lightbulb} title="Insight" value={insights.insight} />
          </div>
        </>
      )}
    </div>
  );
}
