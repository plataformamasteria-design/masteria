"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, DollarSign, Users,
  CalendarCheck, TrendingDown, Lightbulb, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { formatCurrency } from "@/lib/format";
import { useAccountId } from "@/contexts/ad-account-context";
import { TabLoading } from "@/components/ui/tab-loading";
import { InsightRedirect } from "@/components/insight-redirect";

// ── Types ──────────────────────────────────────────────────────────
interface DiaData {
  data: string;
  spend: number;
  leads: number;
  impressoes: number;
  cliques: number;
  cpl: number | null;
  reunioes: number;
  status: "verde" | "amarelo" | "vermelho" | "cinza";
}

interface HeatmapSlot {
  dia_semana: number;
  hora: number;
  leads: number;
  cpl: number | null;
  qualificacao: number | null;
  spend: number;
}

interface CalendarioData {
  mes: string;
  metaCpl: number;
  cplMedio: number;
  dias: DiaData[];
  heatmap: HeatmapSlot[];
  insights: string[];
}

// ── Helpers ────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
const DIAS_NOME = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_NOME_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const HORAS = Array.from({ length: 24 }, (_, i) => i);

function getMesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const meses = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[m]} ${y}`;
}

function navigateMonth(mes: string, dir: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_COLORS: Record<string, string> = {
  verde: "bg-primary",
  amarelo: "bg-amber-400",
  vermelho: "bg-rose-500",
  cinza: "bg-muted-foreground/20",
};

const STATUS_RING: Record<string, string> = {
  verde: "ring-primary/30",
  amarelo: "ring-amber-400/30",
  vermelho: "ring-rose-500/30",
  cinza: "ring-zinc-600/30",
};

// ── Day Detail Drawer ──────────────────────────────────────────────
function DayDrawer({ dia, onClose }: { dia: DiaData; onClose: () => void }) {
  const date = new Date(dia.data + "T12:00:00");
  const dayLabel = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed top-0 right-0 h-full w-full max-w-sm bg-card border-l border-border z-[9999] shadow-2xl overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold capitalize">{dayLabel}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard icon={DollarSign} label="Investimento" value={formatCurrency(dia.spend)} />
          <MetricCard icon={Users} label="Leads" value={String(dia.leads)} />
          <MetricCard icon={TrendingDown} label="CPL" value={dia.cpl != null ? formatCurrency(dia.cpl) : "—"} />
          <MetricCard icon={CalendarCheck} label="Reuniões" value={String(dia.reunioes)} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Detalhes</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Impressões</span>
              <span className="font-mono font-bold">{dia.impressoes.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between py-1.5 px-3 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground">Cliques</span>
              <span className="font-mono font-bold">{dia.cliques.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>

        {date.getDay() === 0 && dia.cpl != null && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200">Domingo com CPL diferenciado — padrão recorrente? Verifique se leads de domingo convertem em reuniões.</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[dia.status]}`} />
          <span className="text-sm text-muted-foreground">
            {dia.status === "verde" ? "CPL abaixo da meta" :
             dia.status === "amarelo" ? "CPL entre meta e 130%" :
             dia.status === "vermelho" ? "CPL acima de 130% da meta" :
             "Sem dados suficientes"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 bg-muted/30 rounded-xl space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-bold font-mono">{value}</p>
    </div>
  );
}

// ── Calendar Grid ──────────────────────────────────────────────────
function CalendarGrid({ dias, mes, onSelectDay }: { dias: DiaData[]; mes: string; onSelectDay: (d: DiaData) => void }) {
  const [y, m] = mes.split("-").map(Number);
  const firstDayOfMonth = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();

  const diaMap = useMemo(() => {
    const map: Record<number, DiaData> = {};
    for (const d of dias) {
      const dayNum = parseInt(d.data.slice(8, 10));
      map[dayNum] = d;
    }
    return map;
  }, [dias]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {DIAS_NOME.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="aspect-square" />;

          const diaData = diaMap[day];
          const status = diaData?.status || "cinza";
          const hasData = !!diaData && diaData.spend > 0;

          return (
            <button
              key={day}
              onClick={() => diaData && onSelectDay(diaData)}
              disabled={!diaData}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-sm relative group ${
                hasData
                  ? `ring-2 ${STATUS_RING[status]} hover:ring-4 cursor-pointer`
                  : "cursor-default opacity-60"
              }`}
            >
              <div className={`absolute inset-1 rounded-md ${STATUS_COLORS[status]} opacity-20`} />
              <span className="relative font-bold text-foreground z-10">{day}</span>
              {hasData && (
                <span className="relative text-[9px] font-mono text-muted-foreground z-10">
                  {diaData.leads}L
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Heatmap Grid ───────────────────────────────────────────────────
function HeatmapGrid({ data }: { data: HeatmapSlot[] }) {
  const [hoveredSlot, setHoveredSlot] = useState<HeatmapSlot | null>(null);

  // Build grid lookup
  const grid = useMemo(() => {
    const g: Record<string, HeatmapSlot> = {};
    for (const slot of data) {
      g[`${slot.dia_semana}-${slot.hora}`] = slot;
    }
    return g;
  }, [data]);

  // Find CPL range for coloring
  const cpls = data.filter((d) => d.cpl != null && d.cpl > 0).map((d) => d.cpl!);
  const minCpl = cpls.length > 0 ? Math.min(...cpls) : 0;
  const maxCpl = cpls.length > 0 ? Math.max(...cpls) : 1;

  function getCellColor(slot: HeatmapSlot | undefined): string {
    if (!slot || slot.leads === 0 || slot.cpl == null) return "bg-muted/50";
    const ratio = maxCpl > minCpl ? (slot.cpl - minCpl) / (maxCpl - minCpl) : 0.5;
    // Inverted: low CPL = green, high CPL = red
    if (ratio <= 0.33) return "bg-primary/60";
    if (ratio <= 0.66) return "bg-amber-400/40";
    return "bg-rose-500/50";
  }

  // Only show hours with data (±2 buffer)
  const horasComDados = data.map((d) => d.hora);
  const minHora = Math.max(0, Math.min(...horasComDados) - 1);
  const maxHora = Math.min(23, Math.max(...horasComDados) + 1);
  const horasVisiveis = horasComDados.length > 0
    ? HORAS.filter((h) => h >= minHora && h <= maxHora)
    : HORAS.filter((h) => h >= 6 && h <= 23);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour headers */}
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(${horasVisiveis.length}, 1fr)` }}>
            <div />
            {horasVisiveis.map((h) => (
              <div key={h} className="text-center text-[9px] font-mono text-muted-foreground py-1">
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>

          {/* Rows: days of the week */}
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <div key={dow} className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(${horasVisiveis.length}, 1fr)` }}>
              <div className="text-xs font-semibold text-muted-foreground flex items-center pr-2">
                {DIAS_NOME_FULL[dow]}
              </div>
              {horasVisiveis.map((h) => {
                const slot = grid[`${dow}-${h}`];
                return (
                  <div
                    key={h}
                    className={`aspect-[2/1] min-h-[24px] rounded-sm transition-all cursor-default relative group ${getCellColor(slot)} hover:ring-1 hover:ring-white/30`}
                    onMouseEnter={() => slot && setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                  >
                    {slot && slot.leads > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/80">
                        {slot.leads}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hovered slot tooltip */}
      <AnimatePresence>
        {hoveredSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl text-xs"
          >
            <span className="font-bold">{DIAS_NOME_FULL[hoveredSlot.dia_semana]} {hoveredSlot.hora}h</span>
            <span>{hoveredSlot.leads} leads</span>
            <span>CPL: {hoveredSlot.cpl != null ? formatCurrency(hoveredSlot.cpl) : "—"}</span>
            {hoveredSlot.qualificacao != null && <span>Qualif: {hoveredSlot.qualificacao.toFixed(0)}%</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>CPL:</span>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary/60" /> Baixo</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-400/40" /> Médio</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-rose-500/50" /> Alto</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted/50" /> Sem dados</div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CalendarioPage() {
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDay, setSelectedDay] = useState<DiaData | null>(null);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [adsetFilter, setAdsetFilter] = useState("");
  const accountId = useAccountId();

  // Calcular último dia do mês corretamente
  const [mesY, mesM] = mes.split("-").map(Number);
  const lastDayOfMonth = new Date(mesY, mesM, 0).getDate();
  const untilDate = `${mes}-${String(lastDayOfMonth).padStart(2, "0")}`;

  let url = `/api/marketing/calendario?mes=${mes}`;
  if (campaignFilter) url += `&campaign_id=${campaignFilter}`;
  if (adsetFilter) url += `&adset_id=${adsetFilter}`;

  const { data, isLoading } = useSWR<CalendarioData>(url, fetcher, { revalidateOnFocus: false });

  // Fetch campaigns for filter dropdown
  const campUrl = accountId ? `/api/meta/campanhas?since=${mes}-01&until=${untilDate}&account_id=${accountId}` : null;
  const { data: campData } = useSWR(campUrl, fetcher, { revalidateOnFocus: false });
  const campanhas = campData?.data || [];

  // Fetch adsets when a campaign is selected
  const adsetUrl = campaignFilter ? `/api/meta/campaign-tree?campaign_id=${campaignFilter}&since=${mes}-01&until=${untilDate}` : null;
  const { data: adsetData } = useSWR(adsetUrl, fetcher, { revalidateOnFocus: false });
  const conjuntos: { id: string; name: string }[] = adsetData?.data || [];

  const goBack = useCallback(() => { setMes((m) => navigateMonth(m, -1)); setSelectedDay(null); }, []);
  const goForward = useCallback(() => { setMes((m) => navigateMonth(m, 1)); setSelectedDay(null); }, []);

  if (isLoading && !data) return <TabLoading message="Carregando calendário..." />;

  const dias = data?.dias || [];
  const heatmap = data?.heatmap || [];
  const insights = data?.insights || [];
  const cplMedio = data?.cplMedio || 0;

  // Summary for legend
  const diasVerdes = dias.filter((d) => d.status === "verde").length;
  const diasAmarelos = dias.filter((d) => d.status === "amarelo").length;
  const diasVermelhos = dias.filter((d) => d.status === "vermelho").length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Calendário de Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            CPL médio do mês: {cplMedio > 0 ? formatCurrency(cplMedio) : "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Campaign filter */}
          <select
            value={campaignFilter}
            onChange={(e) => { setCampaignFilter(e.target.value); setAdsetFilter(""); setSelectedDay(null); }}
            className="rounded-lg border border-border bg-card text-xs px-3 py-2 font-medium focus:outline-none max-w-[200px] truncate"
          >
            <option value="">Todas as campanhas</option>
            {campanhas.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Adset filter — visible only when a campaign is selected */}
          {campaignFilter && conjuntos.length > 0 && (
            <select
              value={adsetFilter}
              onChange={(e) => { setAdsetFilter(e.target.value); setSelectedDay(null); }}
              className="rounded-lg border border-border bg-card text-xs px-3 py-2 font-medium focus:outline-none max-w-[200px] truncate"
            >
              <option value="">Todos os conjuntos</option>
              {conjuntos.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-1">
            <Button variant="ghost" size="sm" onClick={goBack} className="h-8 w-8 p-0">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-bold px-2 min-w-[120px] text-center">{getMesLabel(mes)}</span>
            <Button variant="ghost" size="sm" onClick={goForward} className="h-8 w-8 p-0">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <StatusBadge color="bg-primary" label="CPL abaixo da meta" count={diasVerdes} />
        <StatusBadge color="bg-amber-400" label="CPL entre meta e 130%" count={diasAmarelos} />
        <StatusBadge color="bg-rose-500" label="CPL acima de 130%" count={diasVermelhos} />
      </div>

      {/* Calendar Grid */}
      <SpotlightCard className="p-6">
        <CalendarGrid dias={dias} mes={mes} onSelectDay={setSelectedDay} />
      </SpotlightCard>

      {/* Heatmap Section */}
      <SpotlightCard className="p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Heatmap: Dia da Semana x Hora
        </h2>
        <p className="text-xs text-muted-foreground">
          Onde o CPL é melhor? Identifique os melhores horários para investir.
        </p>
        {heatmap.length > 0 ? (
          <HeatmapGrid data={heatmap} />
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Sem dados temporais para este mês. O cron de performance temporal gera estes dados diariamente.
          </div>
        )}
      </SpotlightCard>

      {/* Insights migrados para Dashboard principal */}
      <InsightRedirect />

      {/* Backdrop + Day Detail Drawer */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDay(null)}
            className="fixed inset-0 bg-black/5 dark:bg-black/40 z-[9998]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedDay && <DayDrawer dia={selectedDay} onClose={() => setSelectedDay(null)} />}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg text-xs">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold font-mono">{count}</span>
    </div>
  );
}

