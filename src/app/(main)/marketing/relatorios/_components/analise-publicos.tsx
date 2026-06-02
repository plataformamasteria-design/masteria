"use client";
import { ComarkaLoading } from "@/components/comarka-loading";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { AdsMetadata } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";

import { cn } from "@/lib/utils";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { Loader2, Users, Target, Sparkles, Globe, UserCheck, TrendingUp, DollarSign, ArrowUpDown, Smartphone, Monitor, Tablet, MapPin, Calendar, Radio } from "lucide-react";
import { m as motion, AnimatePresence } from 'framer-motion';
import { useAudiencesEngine } from "@/hooks/use-audiences-engine";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Card, CardContent } from "@/components/ui/card";

/* ========== TYPES ========== */
interface DemographicRow { label: string; sublabel?: string; spend: number; impressions: number; clicks: number; leads: number; cpl: number; ctr: number; cpc: number; qualificados_est?: number; taxa_qualificacao_est?: number | null; reunioes_realizadas_est?: number; contratos_est?: number | null; mrr_gerado_est?: number | null; cac_est?: number | null; roas_cash_est?: number | null; estimado?: true; }

/* ========== CONFIG ========== */
const TIPO_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
    interest: { label: "Interesse", icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
    behavior: { label: "Comportamento", icon: TrendingUp, color: "text-accent/70", bg: "bg-accent/8" },
    custom_audience: { label: "Público Personalizado", icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
    lookalike: { label: "Lookalike", icon: Users, color: "text-primary", bg: "bg-primary/10" },
};

const SUB_TABS = [
    { id: "audiences", label: "Públicos", icon: Users },
    { id: "age_gender", label: "Idade & Gênero", icon: Calendar },
    { id: "region", label: "Localização", icon: MapPin },
    { id: "device", label: "Dispositivo", icon: Smartphone },
    { id: "platform", label: "Plataforma", icon: Globe },
    { id: "placement", label: "Posicionamento", icon: Radio },
] as const;
type SubTab = typeof SUB_TABS[number]["id"];

/* ========== HELPER: Horizontal Bar ========== */
function BarRow({ label, sublabel, value, max, color, extra }: { label: string; sublabel?: string; value: number; max: number; color: string; extra?: React.ReactNode }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3 py-2 group hover:bg-muted/10 dark:hover:bg-white/[0.02] px-3 rounded-lg transition-colors">
            <div className="w-[140px] shrink-0">
                <p className="text-xs font-medium truncate" title={label}>{label}</p>
                {sublabel && <p className="text-[10px] text-foreground/90 truncate">{sublabel}</p>}
            </div>
            <div className="flex-1 h-7 bg-muted/20 dark:bg-white/[0.03] rounded-md overflow-hidden relative">
                <div className={cn("h-full rounded-md transition-all duration-500 flex items-center px-2", color)} style={{ width: `${Math.max(pct, 2)}%` }}>
                    {pct > 15 && <span className="text-[10px] text-foreground font-bold">{pct.toFixed(1)}%</span>}
                </div>
            </div>
            <div className="w-[200px] shrink-0 flex gap-3 justify-end">
                {extra}
            </div>
        </div>
    );
}

function MetricCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-right">
            <p className="text-[9px] text-foreground/90 uppercase">{label}</p>
            <p className="text-xs font-semibold">{value}</p>
        </div>
    );
}

/* ========== MAIN PAGE ========== */
export function AnalisePublicosCompleta({ since, until, statusFilter, accountId }: { since: string; until: string; statusFilter: string; accountId: string | null }) {
    
    const { data: tData, isLoading: loading } = useTrafegoData(since, until, statusFilter, accountId);

    const metadata = tData?.metadata || [];
    const performance = tData?.performance || [];

    const [demoData, setDemoData] = useState<Record<string, DemographicRow[]>>({});
    const [demoLoading, setDemoLoading] = useState<Record<string, boolean>>({});
    const [demoPermiteContratos, setDemoPermiteContratos] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<SubTab>("audiences");
    const [sortCol, setSortCol] = useState("spend");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [tipoFiltro, setTipoFiltro] = useState("all");

    // Usa o novo sistema central de audiências (Data Engine)
    const { audienceRows, bucketBroad, stats, loadingAudiences } = useAudiencesEngine({
        performance: tData?.performance || [],
        metadata: tData?.metadata || [],
        statusFiltro: statusFilter,
        somenteComDados: true,
        tipoFiltro,
        accountId
    });

    const fetchDemographic = useCallback(async (breakdown: string) => {
        if (demoData[breakdown]) return; // already fetched
        setDemoLoading((prev) => ({ ...prev, [breakdown]: true }));
        try {
            const res = await fetch(`/api/meta-demographics-enriched?since=${since}&until=${until}&breakdown=${breakdown}&account_id=${accountId || ""}`);
            const json = await res.json();
            setDemoData((prev) => ({ ...prev, [breakdown]: json.data || [] }));
            setDemoPermiteContratos((prev) => ({ ...prev, [breakdown]: json.permite_contratos ?? false }));
        } catch {
            setDemoData((prev) => ({ ...prev, [breakdown]: [] }));
        }
        setDemoLoading((prev) => ({ ...prev, [breakdown]: false }));
    }, [since, until, demoData]);

    useEffect(() => {
        if (activeTab !== "audiences" && !demoData[activeTab]) {
            fetchDemographic(activeTab);
        }
    }, [activeTab, fetchDemographic, demoData]);

    const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
    const sorted = useMemo(() => [...audienceRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[sortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0; return sortDir === "asc" ? va - vb : vb - va; }), [audienceRows, sortCol, sortDir]);

    // Combinar linhas normais com o Bucket "Broad" no final, somente se ele tiver spend > 0 e for a aba geral ou tipo selecionado for 'all'
    const finalRows = useMemo(() => {
        const rows = [...sorted];
        if (bucketBroad.spend > 0 && tipoFiltro === "all") {
            rows.push(bucketBroad);
        }
        return rows;
    }, [sorted, bucketBroad, tipoFiltro]);

    const globalCpl = stats.avgCpl;

    if (loading || loadingAudiences) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2  className="w-8 h-8 animate-spin text-foreground/90" />
            <p className="text-foreground/90 text-sm flex items-center gap-2">Sincronizando Metadados com Engine de Públicos<span className="dot-blink1">.</span><span className="dot-blink2">.</span><span className="dot-blink3">.</span></p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                
                {/* TrafegoFilters removido e unificado */}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-muted/30 dark:bg-white/[0.03] rounded-xl p-1">
                {SUB_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors flex-1 justify-center relative",
                                activeTab === tab.id ? "text-foreground" : "text-foreground/90 hover:text-foreground hover:bg-muted/30"
                            )}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="publicos-tab-indicator"
                                    className="absolute inset-0 gradient-primary rounded-lg shadow-sm"
                                    style={{ zIndex: 0 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-1.5">
                                <Icon size={13} />
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ========== AUDIENCES TAB ========== */}
            {activeTab === "audiences" && (
                <>
                    {/* Tipo filter pills */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: "all", label: "Todos" }, { value: "interest", label: "Interesses" },
                            { value: "behavior", label: "Comportamentos" }, { value: "custom_audience", label: "Personalizados" },
                            { value: "lookalike", label: "Lookalikes" },
                        ].map((opt) => (
                            <button key={opt.value} onClick={() => setTipoFiltro(opt.value)}
                                className={cn("px-3 py-1.5 text-xs rounded-lg border transition-all",
                                    tipoFiltro === opt.value ? "gradient-primary text-foreground border-transparent" : "border-border text-foreground/90 hover:text-foreground"
                                )}>{opt.label}</button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <SpotlightCard><div className="p-5 flex flex-col justify-between"><div className="flex items-center gap-2 mb-2"><DollarSign size={16} className="text-foreground/90 text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5" /><span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5 mt-1">Total Investido</span></div><p className="text-2xl font-medium tracking-tight mt-2">{formatCurrency(stats.totalSpend)}</p></div></SpotlightCard>
                        <SpotlightCard><div className="p-5 flex flex-col justify-between"><div className="flex items-center gap-2 mb-2"><Users size={16} className="text-foreground/90 text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5" /><span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5 mt-1">Total Leads</span></div><p className="text-2xl font-medium tracking-tight mt-2">{stats.totalLeads}</p></div></SpotlightCard>
                        <SpotlightCard><div className="p-5 flex flex-col justify-between"><div className="flex items-center gap-2 mb-2"><Target size={16} className="text-foreground/90 text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5" /><span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5 mt-1">CPL Médio</span></div><p className="text-2xl font-medium tracking-tight mt-2">{stats.avgCpl > 0 ? formatCurrency(stats.avgCpl) : "—"}</p></div></SpotlightCard>
                        <SpotlightCard><div className="p-5 flex flex-col justify-between"><div className="flex items-center gap-2 mb-2"><Globe size={16} className="text-foreground/90 text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5" /><span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-0.5 mt-1">Públicos Ativos</span></div><p className="text-2xl font-medium tracking-tight mt-2">{stats.total}</p></div></SpotlightCard>
                    </div>

                    {sorted.length === 0 ? (
                        <SpotlightCard  className="py-12 text-center text-foreground/90">Nenhum público encontrado para o período.</SpotlightCard>
                    ) : (
                        <SpotlightCard className="overflow-hidden bg-background/50 backdrop-blur-xl border-border/20"><div className="overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-border/20 text-[10px] font-bold text-foreground/90 uppercase tracking-[0.1em]">
                                    <tr className="border-b border-border text-foreground/90">
                                        <th className="px-5 py-4 text-left">Público / Interesse</th>
                                        <th className="px-5 py-4 text-left">Tipo</th>
                                        <th className="px-5 py-4 text-left">Campanhas</th>
                                        <th onClick={() => toggleSort("spend")} className="px-5 py-4 text-right cursor-pointer hover:text-foreground whitespace-nowrap">Investido {sortCol === "spend" && <ArrowUpDown size={10} className="inline" />}</th>
                                        <th onClick={() => toggleSort("leads")} className="px-5 py-4 text-right cursor-pointer hover:text-foreground whitespace-nowrap">Leads {sortCol === "leads" && <ArrowUpDown size={10} className="inline" />}</th>
                                        <th onClick={() => toggleSort("cpl")} className="px-5 py-4 text-right cursor-pointer hover:text-foreground whitespace-nowrap">CPL {sortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}</th>
                                        <th onClick={() => toggleSort("impressoes")} className="px-5 py-4 text-right cursor-pointer hover:text-foreground whitespace-nowrap">Impressões {sortCol === "impressoes" && <ArrowUpDown size={10} className="inline" />}</th>
                                        <th onClick={() => toggleSort("ctr")} className="px-5 py-4 text-right cursor-pointer hover:text-foreground whitespace-nowrap">CTR {sortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}</th>
                                        <th className="px-5 py-4 text-center">Conjuntos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {finalRows.map((aud, i) => {
                                            const cfg = aud.tipo === "broad" ? { label: "Amplo", icon: Sparkles, color: "text-foreground/90", bg: "bg-zinc-500/10" } : TIPO_CONFIG[aud.tipo] || TIPO_CONFIG.interest;
                                            const Icon = cfg.icon;
                                            return (
                                                <motion.tr
                                                    key={`${aud.id}-${i}`}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={cn(
                                                        "border-b border-border hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors",
                                                        aud.tipo === "broad" && "bg-muted/10 dark:bg-white/[0.01]"
                                                    )}
                                                >
                                                    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5">
                                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}><Icon size={14} className={cfg.color} /></div>
                                                        <span className="text-xs font-medium truncate max-w-[200px]" title={aud.name}>{aud.name}</span>
                                                    </div></td>
                                                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px]", cfg.bg, cfg.color)}>{cfg.label}</Badge></td>
                                                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1 max-w-[180px]">
                                                        {aud.campaignNames.slice(0, 2).map((c, ci) => <span key={ci} className="text-[10px] text-foreground/90 bg-muted/50 dark:bg-white/[0.04] rounded px-1.5 py-0.5 truncate max-w-[80px]" title={c}>{c.length > 15 ? c.slice(0, 14) + "…" : c}</span>)}
                                                        {aud.campaignNames.length > 2 && <span className="text-[10px] text-foreground/90">+{aud.campaignNames.length - 2}</span>}
                                                    </div></td>
                                                    <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(aud.spend)}</td>
                                                    <td className="px-3 py-2.5 text-right text-xs font-bold">{aud.leads}</td>
                                                    <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.cpl > 0 && aud.cpl < globalCpl * 0.8 ? "text-primary" : aud.cpl > globalCpl * 1.3 ? "text-primary" : "")}>
                                                        {aud.leads > 0 ? formatCurrency(aud.cpl) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-xs">{aud.impressoes.toLocaleString("pt-BR")}</td>
                                                    <td className={cn("px-3 py-2.5 text-right text-xs font-medium", aud.ctr >= 1.5 ? "text-primary" : aud.ctr > 0 && aud.ctr < 0.8 ? "text-primary" : "")}>{formatPercent(aud.ctr)}</td>
                                                    <td className="px-3 py-2.5 text-center"><Badge  className="text-[10px] bg-muted text-foreground/90">{aud.adsets.length}</Badge></td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div></SpotlightCard>
                    )}
                </>
            )}

            {/* ========== DEMOGRAPHIC TABS ========== */}
            {activeTab !== "audiences" && (
                <DemographicPanel
                    rows={demoData[activeTab] || []}
                    loading={!!demoLoading[activeTab]}
                    breakdown={activeTab}
                    somenteComDados={true}
                    permiteContratos={demoPermiteContratos[activeTab] ?? false}
                />
            )}
        </div>
    );
}

/* ========== ESTIMATED TOOLTIP ========== */
function EstTooltip({ children }: { children: React.ReactNode }) {
    return (
        <span className="cursor-help border-b border-dashed border-muted-foreground/30" title="Estimado por atribuicao proporcional ao spend. Nao e valor exato.">
            {children}
        </span>
    );
}

/* ========== DEMOGRAPHIC PANEL ========== */
function DemographicPanel({ rows, loading, breakdown, somenteComDados, permiteContratos = false }: { rows: DemographicRow[]; loading: boolean; breakdown: string; somenteComDados: boolean; permiteContratos?: boolean }) {
    const [sortCol, setSortCol] = useState("spend");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Aggregate/group data — MUST be before any conditional return (React hooks rule)
    const grouped = useMemo(() => {
        if (loading || rows.length === 0) return [];
        const map = new Map<string, DemographicRow & { count: number }>();
        for (const row of rows) {
            const key = breakdown === "age_gender" ? `${row.label}|${row.sublabel || ""}` : row.label;
            if (map.has(key)) {
                const g = map.get(key)!;
                g.spend += row.spend; g.impressions += row.impressions; g.clicks += row.clicks; g.leads += row.leads;
                g.qualificados_est = (g.qualificados_est || 0) + (row.qualificados_est || 0);
                g.reunioes_realizadas_est = (g.reunioes_realizadas_est || 0) + (row.reunioes_realizadas_est || 0);
                if (row.contratos_est != null) g.contratos_est = (g.contratos_est || 0) + row.contratos_est;
                if (row.mrr_gerado_est != null) g.mrr_gerado_est = (g.mrr_gerado_est || 0) + row.mrr_gerado_est;
                g.count++;
            } else {
                map.set(key, { ...row, count: 1 });
            }
        }
        return Array.from(map.values()).map((g) => {
            const cpl = g.leads > 0 ? g.spend / g.leads : 0;
            const ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0;
            const cpc = g.clicks > 0 ? g.spend / g.clicks : 0;
            const taxa_qualificacao_est = g.leads > 0 && g.qualificados_est ? (g.qualificados_est / g.leads) * 100 : null;
            const cac_est = g.contratos_est && g.contratos_est > 0 ? g.spend / g.contratos_est : null;
            const roas_cash_est = g.roas_cash_est;
            return { ...g, cpl, ctr, cpc, taxa_qualificacao_est, cac_est, roas_cash_est };
        });
    }, [rows, breakdown, loading]);

    if (loading) return <ComarkaLoading />;

    const filtered = somenteComDados ? grouped.filter((r) => r.spend > 0) : grouped;
    const sorted = [...filtered].sort((a, b) => {
        const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
        const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
        return sortDir === "asc" ? va - vb : vb - va;
    });

    const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
    const totalLeads = filtered.reduce((s, r) => s + r.leads, 0);
    const totalImpressions = filtered.reduce((s, r) => s + r.impressions, 0);
    const maxSpend = Math.max(...filtered.map((r) => r.spend), 1);

    const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };

    if (filtered.length === 0) return <Card><CardContent  className="py-12 text-center text-foreground/90">Nenhum dado demográfico encontrado para o período.</CardContent></Card>;

    // Color per breakdown — brand accent palette
    const barColor = breakdown === "age_gender" ? "bg-gradient-to-r from-accent to-accent" :
        breakdown === "region" ? "bg-gradient-to-r from-primary to-transparent" :
            breakdown === "device" ? "bg-gradient-to-r from-accent to-accent" :
                "bg-gradient-to-r from-primary to-accent/70";

    const deviceIcon = (label: string) => {
        if (label.toLowerCase().includes("mobile")) return <Smartphone size={14} />;
        if (label.toLowerCase().includes("desktop")) return <Monitor size={14} />;
        if (label.toLowerCase().includes("tablet")) return <Tablet size={14} />;
        return <Smartphone size={14} />;
    };

    const GENDER_NAMES: Record<string, string> = { Masculino: "♂ Masculino", Feminino: "♀ Feminino", unknown: "Não informado" };

    return (
        <>
            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SpotlightCard className="p-5 flex flex-col gap-1"><span className="text-[10px] uppercase font-bold tracking-widest text-primary/80">Total Investido</span><p className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(totalSpend)}</p></SpotlightCard>
                <SpotlightCard className="p-5 flex flex-col gap-1"><span className="text-[10px] uppercase font-bold tracking-widest text-primary/80">Total Leads</span><p className="text-2xl font-bold tracking-tight mt-1">{totalLeads}</p></SpotlightCard>
                <SpotlightCard className="p-5 flex flex-col gap-1"><span className="text-[10px] uppercase font-bold tracking-widest text-primary/80">CPL Médio</span><p className="text-2xl font-bold tracking-tight mt-1">{totalLeads > 0 ? formatCurrency(totalSpend / totalLeads) : "—"}</p></SpotlightCard>
                <SpotlightCard className="p-5 flex flex-col gap-1"><span className="text-[10px] uppercase font-bold tracking-widest text-primary/80">Segmentos</span><p className="text-2xl font-bold tracking-tight mt-1">{filtered.length}</p></SpotlightCard>
            </div>

            {/* Visual Bar Chart */}
            <SpotlightCard className="p-5 space-y-1">
                    <p className="text-[10px] font-bold text-foreground/90 uppercase tracking-[0.12em] mb-4">
                        Distribuição por {breakdown === "age_gender" ? "Idade & Gênero" : breakdown === "region" ? "Localização" : breakdown === "device" ? "Dispositivo" : breakdown === "placement" ? "Posicionamento" : "Plataforma"}
                    </p>
                    {sorted.slice(0, 15).map((row, i) => {
                        const displayLabel = breakdown === "device"
                            ? row.label
                            : breakdown === "age_gender"
                                ? `${row.label} · ${GENDER_NAMES[row.sublabel || ""] || row.sublabel || ""}`
                                : row.sublabel ? `${row.label} · ${row.sublabel}` : row.label;

                        return (
                            <BarRow
                                key={`${row.label}-${row.sublabel}-${i}`}
                                label={displayLabel}
                                value={row.spend}
                                max={maxSpend}
                                color={barColor}
                                extra={
                                    <>
                                        <MetricCell label="Invest." value={formatCurrency(row.spend)} />
                                        <MetricCell label="Leads" value={String(row.leads)} />
                                        <MetricCell label="CPL" value={row.leads > 0 ? formatCurrency(row.cpl) : "—"} />
                                    </>
                                }
                            />
                        );
                    })}
            </SpotlightCard>

            {/* Detailed Table */}
            <SpotlightCard className="overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-foreground/90">
                                    <th className="px-3 py-2.5 text-left font-medium text-xs">
                                        {breakdown === "age_gender" ? "Faixa Etária" : breakdown === "region" ? "Região" : breakdown === "device" ? "Dispositivo" : breakdown === "placement" ? "Posicionamento" : "Plataforma"}
                                    </th>
                                    {breakdown === "age_gender" && <th className="px-3 py-2.5 text-left font-medium text-xs">Gênero</th>}
                                    {breakdown === "region" && <th className="px-3 py-2.5 text-left font-medium text-xs">País</th>}
                                    {breakdown === "platform" && <th className="px-3 py-2.5 text-left font-medium text-xs">Posição</th>}
                                    {breakdown === "placement" && <th className="px-3 py-2.5 text-left font-medium text-xs">Plataforma</th>}
                                    <th onClick={() => toggleSort("spend")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Investido {sortCol === "spend" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th className="px-3 py-2.5 text-right font-medium text-xs">% Budget</th>
                                    <th onClick={() => toggleSort("leads")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Leads {sortCol === "leads" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("cpl")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        CPL {sortCol === "cpl" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("impressions")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        Impressões {sortCol === "impressions" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("ctr")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap">
                                        CTR {sortCol === "ctr" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    {/* Colunas de funil estimadas */}
                                    <th onClick={() => toggleSort("qualificados_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">
                                        Qualif. <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "qualificados_est" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("taxa_qualificacao_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">
                                        Tx.Qualif <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "taxa_qualificacao_est" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    <th onClick={() => toggleSort("reunioes_realizadas_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">
                                        Reunioes <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "reunioes_realizadas_est" && <ArrowUpDown size={10} className="inline" />}
                                    </th>
                                    {permiteContratos && <th onClick={() => toggleSort("contratos_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">Contratos <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "contratos_est" && <ArrowUpDown size={10} className="inline" />}</th>}
                                    {permiteContratos && <th onClick={() => toggleSort("mrr_gerado_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">MRR <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "mrr_gerado_est" && <ArrowUpDown size={10} className="inline" />}</th>}
                                    {permiteContratos && <th onClick={() => toggleSort("cac_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">CAC <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "cac_est" && <ArrowUpDown size={10} className="inline" />}</th>}
                                    {permiteContratos && <th onClick={() => toggleSort("roas_cash_est")} className="px-3 py-2.5 text-right font-medium text-xs cursor-pointer hover:text-foreground whitespace-nowrap" title="Estimado por atribuicao proporcional ao spend">ROAS Cash <span className="text-[8px] text-amber-400">⚡</span> {sortCol === "roas_cash_est" && <ArrowUpDown size={10} className="inline" />}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((row, i) => {
                                    const budgetPct = totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0;
                                    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
                                    return (
                                        <tr key={`${row.label}-${row.sublabel}-${i}`} className="border-b border-border hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-2.5 text-xs font-medium">
                                                <div className="flex items-center gap-2">
                                                    {breakdown === "device" && <span className="text-foreground/90">{deviceIcon(row.label)}</span>}
                                                    {row.label}
                                                </div>
                                            </td>
                                            {breakdown === "age_gender" && <td className="px-3 py-2.5 text-xs">
                                                <Badge className={cn("text-[9px]", row.sublabel === "Masculino" ? "bg-primary/10 text-primary" : row.sublabel === "Feminino" ? "bg-primary/10 text-primary" : "bg-muted text-foreground/90")}>
                                                    {GENDER_NAMES[row.sublabel || ""] || row.sublabel}
                                                </Badge>
                                            </td>}
                                            {breakdown === "region" && <td className="px-3 py-2.5 text-xs text-foreground/90">{row.sublabel || "—"}</td>}
                                            {breakdown === "platform" && <td className="px-3 py-2.5 text-xs text-foreground/90 capitalize">{row.sublabel || "\u2014"}</td>}
                                            {breakdown === "placement" && <td className="px-3 py-2.5 text-xs text-foreground/90 capitalize">{row.sublabel || "\u2014"}</td>}
                                            <td className="px-3 py-2.5 text-right text-xs font-medium">{formatCurrency(row.spend)}</td>
                                            <td className="px-3 py-2.5 text-right text-xs">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <div className="w-12 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${budgetPct}%` }} />
                                                    </div>
                                                    <span className="text-foreground/90">{budgetPct.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold">{row.leads}</td>
                                            <td className={cn("px-3 py-2.5 text-right text-xs font-medium",
                                                row.cpl > 0 && row.cpl < avgCpl * 0.8 ? "text-primary" :
                                                    row.cpl > avgCpl * 1.3 ? "text-primary" : ""
                                            )}>
                                                {row.leads > 0 ? formatCurrency(row.cpl) : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs">{row.impressions.toLocaleString("pt-BR")}</td>
                                            <td className={cn("px-3 py-2.5 text-right text-xs font-medium", row.ctr >= 1.5 ? "text-primary" : row.ctr < 0.8 && row.ctr > 0 ? "text-primary" : "")}>
                                                {formatPercent(row.ctr)}
                                            </td>
                                            {/* Colunas de funil estimadas */}
                                            <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.qualificados_est ?? "—"}</EstTooltip></td>
                                            <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.taxa_qualificacao_est != null ? formatPercent(row.taxa_qualificacao_est) : "—"}</EstTooltip></td>
                                            <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.reunioes_realizadas_est ?? "—"}</EstTooltip></td>
                                            {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.contratos_est ?? "—"}</EstTooltip></td>}
                                            {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.mrr_gerado_est != null ? formatCurrency(row.mrr_gerado_est) : "—"}</EstTooltip></td>}
                                            {permiteContratos && <td className="px-3 py-2.5 text-right text-xs"><EstTooltip>{row.cac_est != null ? formatCurrency(row.cac_est) : "—"}</EstTooltip></td>}
                                            {permiteContratos && <td className="px-3 py-2.5 text-right text-xs font-medium"><EstTooltip>{formatRoas(row.roas_cash_est)}</EstTooltip></td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
            </SpotlightCard>
        </>
    );
}


