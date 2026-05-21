"use client";
/**
 * Relatório de Performance Meta Ads
 * Premium redesign — brand accent palette, SpotlightCard-based layout
 */
import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Search, ArrowUpDown,
  BarChart2, Users, Layers, Film, Globe2, RefreshCw,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle2, AlertCircle,
  DollarSign, Target, MousePointer2, Link, BarChart3, Radio, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useRelatorioData, useReportFilters, type SortMetric, type ReportLevel } from "@/hooks/use-relatorio-data";
import { useAccountId } from "@/contexts/ad-account-context";
import { AnalisePublicosCompleta } from "./_components/analise-publicos";
import { TabLoading } from "@/components/ui/tab-loading";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number, digits = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtCur = (n: number | null) => n == null ? "—" : `R$ ${fmt(n, 2)}`;
const fmtPct = (n: number | null) => n == null ? "—" : `${fmt(n, 1)}%`;
const fmtN   = (n: number | null) => n == null ? "—" : fmt(n);

function DeltaBadge({ pct, sem = "higher" }: { pct: number | null; sem?: "higher" | "lower" | "neutral" }) {
  if (pct === null) return <span className="text-foreground/90 text-xs">—</span>;
  const isGood = sem === "neutral" ? null : sem === "higher" ? pct >= 0 : pct <= 0;
  const color  = isGood === null ? "text-foreground/90" : isGood ? "text-primary" : "text-rose-400";
  const Icon   = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" /> {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const cfg = label === "good"    ? { color: "bg-primary/10 text-primary border-primary/20", icon: "✓" }
            : label === "average" ? { color: "bg-amber-500/10 text-amber-400 border-amber-500/20",     icon: "~" }
            :                       { color: "bg-rose-500/10 text-rose-400 border-rose-500/20",             icon: "!" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {score}
    </span>
  );
}

function SortTh({ label, metric, sortMetric, sortDir, onSort }: {
  label: string; metric: SortMetric;
  sortMetric: SortMetric; sortDir: "asc" | "desc";
  onSort: (m: SortMetric) => void;
}) {
  const active = metric === sortMetric;
  return (
    <th
      className={`px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors ${active ? "text-primary" : "text-foreground/90 hover:text-foreground/90"}`}
      onClick={() => onSort(metric)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        {active ? (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const color = s === "ACTIVE" ? "bg-primary/10 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
              : s === "PAUSED" ? "bg-primary/10"
              : "bg-zinc-600";
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

// ── Seção 1: Filtros ───────────────────────────────────────────────────────────

function FilterBar({
  since, until, level, statusFilter, search, isLoading,
  setSince, setUntil, setLevel, setStatusFilter, setSearch, onRefresh,
}: any) {
  const presets = [
    { label: "7d",  days: 7 },
    { label: "14d", days: 14 },
    { label: "30d", days: 30 },
    { label: "60d", days: 60 },
    { label: "90d", days: 90 },
  ];

  const applyPreset = (days: number) => {
    const now = new Date();
    const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const prev = new Date(now); prev.setDate(prev.getDate() - days);
    const start = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
    setSince(start); setUntil(end);
  };

  const levels: { id: ReportLevel; label: string; icon: any }[] = [
    { id: "campaign", label: "Campanhas",  icon: BarChart2 },
    { id: "adset",    label: "Conjuntos",  icon: Layers },
    { id: "ad",       label: "Anúncios",   icon: Film },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: datas + presets */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-lg border border-border px-3 py-1.5">
          <input type="date" value={since} onChange={e => setSince(e.target.value)}
            className="bg-transparent text-foreground text-sm focus:outline-none" />
          <span className="text-foreground/90 text-sm">→</span>
          <input type="date" value={until} onChange={e => setUntil(e.target.value)}
            className="bg-transparent text-foreground text-sm focus:outline-none" />
        </div>
        <div className="flex gap-1">
          {presets.map(p => (
            <button key={p.days} onClick={() => applyPreset(p.days)}
              className="text-xs px-2.5 py-1.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 border border-border text-foreground/90 hover:text-foreground transition-colors">
              {p.label}
            </button>
          ))}
        </div>
        <Button  variant="outline" size="sm" onClick={onRefresh}
          className="ml-auto gap-1.5 border-border bg-transparent text-foreground/90 hover:text-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Linha 2: nivel + status + busca */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {levels.map(l => (
            <button key={l.id} onClick={() => setLevel(l.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${level === l.id ? "bg-accent text-foreground" : "bg-white/4 text-foreground/90 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/8"}`}>
              <l.icon className="h-3.5 w-3.5" />{l.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(["all","ACTIVE","PAUSED"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 font-semibold transition-colors ${statusFilter === s ? "bg-black/10 dark:bg-white/15 text-foreground" : "bg-white/4 text-foreground/90 hover:text-foreground"}`}>
              {s === "all" ? "Todos" : s === "ACTIVE" ? "Ativo" : "Pausado"}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/90" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-8 h-8 text-xs bg-black/5 dark:bg-white/5 border-border text-foreground w-52" />
        </div>
      </div>
    </div>
  );
}

// ── Seção 2: KPIs Gerais ──────────────────────────────────────────────────────

function KPIGrid({ totals, totalsPrev, period }: any) {
  if (!totals) return null;

  const leads   = totals.leads     || 0;
  const spend   = totals.spend     || 0;
  const clicks  = totals.clicks    || 0;
  const impr    = totals.impressions || 0;
  const reach   = totals.reach     || 0;
  const ilc     = totals.inline_link_clicks || 0;

  const cpl     = leads > 0 ? spend / leads : null;
  const ctr     = impr  > 0 ? (clicks / impr) * 100 : null;
  const cpm     = impr  > 0 ? (spend  / impr) * 1000 : null;
  const cpc     = clicks > 0 ? spend / clicks : null;
  const ctr_l   = impr  > 0 && ilc > 0 ? (ilc / impr) * 100 : null;

  const lp      = totalsPrev;
  const prevLeads  = lp?.leads    || 0;
  const prevSpend  = lp?.spend    || 0;
  const prevClick  = lp?.clicks   || 0;
  const prevImpr   = lp?.impressions || 0;
  const prevReach  = lp?.reach    || 0;
  const prevIlc    = lp?.inline_link_clicks || 0;
  const prevCpl    = prevLeads > 0 ? prevSpend  / prevLeads  : null;
  const prevCtr    = prevImpr  > 0 ? (prevClick / prevImpr)  * 100 : null;
  const prevCpm    = prevImpr  > 0 ? (prevSpend / prevImpr)  * 1000 : null;
  const prevCpc    = prevClick > 0 ? prevSpend  / prevClick  : null;
  const prevCtrL   = prevImpr  > 0 && prevIlc > 0 ? (prevIlc / prevImpr) * 100 : null;

  const d = (cur: number | null, prev: number | null) =>
    cur && prev && prev !== 0 ? ((cur - prev) / prev) * 100 : null;

  const kpis = [
    { label: "Investimento",      value: fmtCur(spend),       delta: d(spend,   prevSpend),  sem: "neutral" as const, icon: <DollarSign size={14} /> },
    { label: "Leads Gerados",     value: fmtN(leads),         delta: d(leads,   prevLeads),  sem: "higher"  as const, icon: <Target size={14} /> },
    { label: "CPL",               value: fmtCur(cpl),         delta: d(cpl,     prevCpl),    sem: "lower"   as const, icon: <TrendingDown size={14} /> },
    { label: "CTR",               value: fmtPct(ctr),         delta: d(ctr,     prevCtr),    sem: "higher"  as const, icon: <MousePointer2 size={14} /> },
    { label: "CTR Link",          value: fmtPct(ctr_l),       delta: d(ctr_l,   prevCtrL),   sem: "higher"  as const, icon: <Link size={14} /> },
    { label: "CPM",               value: fmtCur(cpm),         delta: d(cpm,     prevCpm),    sem: "lower"   as const, icon: <BarChart3 size={14} /> },
    { label: "CPC",               value: fmtCur(cpc),         delta: d(cpc,     prevCpc),    sem: "lower"   as const, icon: <MousePointer2 size={14} /> },
    { label: "Alcance",           value: fmtN(reach),         delta: d(reach,   prevReach),  sem: "higher"  as const, icon: <Radio size={14} /> },
    { label: "Impressões",        value: fmtN(impr),          delta: d(impr,    prevImpr),   sem: "higher"  as const, icon: <Eye size={14} /> },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
      {kpis.map((k, i) => (
        <div key={k.label} className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}>
          <SpotlightCard className="p-4 space-y-1.5 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-primary/70">{k.label}</span>
              <span className="text-sm">{k.icon}</span>
            </div>
            <p className="text-base font-bold tracking-tight">{k.value}</p>
            {lp && <DeltaBadge pct={k.delta} sem={k.sem} />}
          </SpotlightCard>
        </div>
      ))}
    </div>
  );
}

// ── Seção 3: Tendência Temporal ────────────────────────────────────────────────

const METRIC_OPTS = [
  { key: "spend",  label: "Investimento", color: "#f97316", format: fmtCur },
  { key: "leads",  label: "Leads",        color: "#fb923c", format: fmtN },
  { key: "cpl",    label: "CPL",          color: "#ea580c", format: fmtCur },
  { key: "ctr",    label: "CTR (%)",      color: "#f59e0b", format: fmtPct },
  { key: "cpm",    label: "CPM",          color: "#fdba74", format: fmtCur },
];

function TrendChart({ trendData }: { trendData: any[] }) {
  const [activeMetrics, setActiveMetrics] = useState(["spend", "leads", "cpl"]);
  const toggleMetric = (key: string) =>
    setActiveMetrics(prev => prev.includes(key) ? (prev.length > 1 ? prev.filter(m => m !== key) : prev) : [...prev, key]);

  if (!trendData.length) return (
    <div className="flex items-center justify-center h-40 text-foreground/90 text-sm">Sem dados de tendência para o período</div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {METRIC_OPTS.map(m => (
          <button key={m.key} onClick={() => toggleMetric(m.key)}
            className={`text-[11px] px-3 py-1 rounded-full border transition-all font-semibold ${activeMetrics.includes(m.key) ? "border-transparent text-foreground" : "border-border text-foreground/90 bg-transparent hover:text-foreground"}`}
            style={activeMetrics.includes(m.key) ? { backgroundColor: m.color + "25", borderColor: m.color + "60", color: m.color } : {}}>
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={50} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            formatter={(value: any, name: string) => {
              const m = METRIC_OPTS.find(o => o.label === name);
              return [m ? m.format(Number(value)) : value, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          {METRIC_OPTS.filter(m => activeMetrics.includes(m.key)).map(m => (
            <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
              stroke={m.color} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Seção 4/5/6: Ranking Table ─────────────────────────────────────────────────

function RankingTable({ rows, level, sortMetric, sortDir, toggleSort }: any) {
  if (!rows.length) return (
    <div className="flex items-center justify-center h-32 text-foreground/90 text-sm">Nenhum dado para o período selecionado</div>
  );

  const cols: { label: string; metric: SortMetric; format: (r: any) => string; sem: "higher"|"lower"|"neutral" }[] = [
    { label: "Invest.",  metric: "spend",     format: r => fmtCur(r.spend),       sem: "neutral" },
    { label: "Leads",    metric: "leads",     format: r => fmtN(r.leads),          sem: "higher" },
    { label: "CPL",      metric: "cpl",       format: r => fmtCur(r.cpl),          sem: "lower" },
    { label: "CTR",      metric: "ctr",       format: r => fmtPct(r.ctr),          sem: "higher" },
    { label: "CPM",      metric: "cpm",       format: r => fmtCur(r.cpm),          sem: "lower" },
    { label: "Freq.",    metric: "frequency", format: r => r.frequency ? fmt(r.frequency, 1) + "x" : "—", sem: "lower" },
    { label: "Alcance",  metric: "reach",     format: r => fmtN(r.reach),          sem: "higher" },
    { label: "Score",    metric: "score",     format: r => "",                      sem: "higher" },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-border bg-white/3">
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/90 min-w-[220px]">
              {level === "campaign" ? "Campanha" : level === "adset" ? "Conjunto" : "Anúncio"}
            </th>
            {cols.map(c => (
              <SortTh key={c.metric} label={c.label} metric={c.metric}
                sortMetric={sortMetric} sortDir={sortDir} onSort={toggleSort} />
            ))}
            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/90">Δ vs Ant.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => {
            const freqHigh = row.frequency > 3.5;
            return (
              <tr key={row.id}
                className="border-b border-border hover:bg-white/3 transition-colors animate-in fade-in duration-300"
                style={{ animationDelay: `${Math.min(i, 15) * 20}ms`, animationFillMode: "both" }}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={row.effective_status || row.status} />
                    <span className="font-medium text-foreground truncate text-xs max-w-[200px]" title={row.name}>
                      {row.name}
                    </span>
                  </div>
                  {row.parent_name && (
                    <p className="text-[10px] text-foreground/90 truncate pl-4">{row.parent_name}</p>
                  )}
                </td>
                {cols.map(c => (
                  <td key={c.metric} className={`px-3 py-2.5 text-right font-mono text-xs ${c.metric === sortMetric ? "text-accent/70 font-bold" : "text-foreground/90"}`}>
                    {c.metric === "score"
                      ? <ScoreBadge score={row.score ?? 0} label={row.score_label ?? "poor"} />
                      : c.metric === "frequency" && freqHigh
                        ? <span className="text-primary font-bold">{c.format(row)}</span>
                        : c.format(row)
                    }
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <DeltaBadge pct={row.delta?.[sortMetric === "score" ? "leads" : sortMetric] ?? null}
                    sem={cols.find(c => c.metric === sortMetric)?.sem ?? "neutral"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Seção 7: Públicos ──────────────────────────────────────────────────────────

// ── Página Principal ───────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { filters, setSince, setUntil, setLevel, toggleSort, setStatusFilter, setSearch } = useReportFilters();
  const { rows, totals, totalsPrev, trendData, isLoading, period, mutate: mutateRelatorio } = useRelatorioData(filters);
  const accountId = useAccountId();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/meta/cache-clear", { method: "POST" });
      await mutateRelatorio();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !rows.length) {
    return <TabLoading message="Sincronizando Relatórios..." />;
  }

  const sections = [
    { id: "kpis",      label: "KPIs",        icon: TrendingUp },
    { id: "tendencia", label: "Tendência",    icon: BarChart2 },
    { id: "ranking",   label: "Ranking",      icon: Layers },
    { id: "publicos",  label: "Públicos",     icon: Users },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" /> Relatório de Performance
        </h1>
        <p className="text-sm text-foreground/90">
          Análise comparativa {period.since} → {period.until} vs {period.prevSince} → {period.prevUntil}
        </p>
      </div>

      {/* Filtros */}
      <FilterBar
        since={filters.since} until={filters.until} level={filters.level}
        statusFilter={filters.statusFilter} search={filters.search}
        isLoading={isLoading || isRefreshing}
        setSince={setSince} setUntil={setUntil} setLevel={setLevel}
        setStatusFilter={setStatusFilter} setSearch={setSearch}
        onRefresh={handleRefresh}
      />

      {/* Seção 2: KPIs */}
      <section className="space-y-3">
        <SectionTitle icon={TrendingUp} label="Visão Geral" color="text-primary" />
        <KPIGrid totals={totals} totalsPrev={totalsPrev} period={period} />
      </section>

      {/* Seção 3: Tendência */}
      <section className="space-y-3">
        <SectionTitle icon={BarChart2} label="Tendência Diária" color="text-primary" />
        <SpotlightCard className="p-5">
          <TrendChart trendData={trendData} />
        </SpotlightCard>
      </section>

      {/* Seção 4/5/6: Ranking */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle
            icon={Layers}
            label={`Ranking de ${filters.level === "campaign" ? "Campanhas" : filters.level === "adset" ? "Conjuntos" : "Anúncios"}`}
            color="text-primary"
            count={rows.length}
          />
          {isLoading && <RefreshCw  className="h-4 w-4 animate-spin text-foreground/90" />}
        </div>
        <SpotlightCard className="overflow-hidden">
          <RankingTable
            rows={rows} level={filters.level}
            sortMetric={filters.sortMetric} sortDir={filters.sortDir}
            toggleSort={toggleSort}
          />
        </SpotlightCard>
      </section>

      {/* Seção 7: Públicos */}
      <section className="space-y-3">
        <SectionTitle icon={Users} label="Análise de Públicos" color="text-primary" />
        <SpotlightCard className="p-5">
          <AnalisePublicosCompleta 
            since={filters.since} 
            until={filters.until} 
            statusFilter={filters.statusFilter} 
            accountId={accountId} 
          />
        </SpotlightCard>
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, color, count }: { icon: any; label: string; color: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <h2 className="text-sm font-bold text-foreground/90 tracking-tight">{label}</h2>
      {count !== undefined && (
        <span className="text-[10px] text-foreground/90 font-mono bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}
