"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ArrowUpDown, Image, Video, Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { VideoDateFilter } from "@/components/video-dashboard/VideoDateFilter";

interface EnrichedCreative {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  format: "video" | "image" | "carousel" | "unknown";
  thumbnail_url: string | null;
  status: string;
  spend: number;
  leads_totais: number;
  cpl: number | null;
  ctr: number;
  leads_qualificados: number;
  taxa_qualificacao: number;
  cpql: number | null;
  reunioes_geradas: number;
  ltv_medio: number | null;
  video_retention_50: number | null;
}

type SortField = "cpql" | "spend" | "cpl" | "taxa_qualificacao" | "ltv_medio" | "leads_qualificados";

const PAGE_SIZE = 20;

const FORMAT_ICON = {
  video: <Video size={12} />,
  image: <Image size={12} />,
  carousel: <Layers size={12} />,
  unknown: <Image size={12} />,
};

const FORMAT_LABEL = { video: "Video", image: "Imagem", carousel: "Carrossel", unknown: "Outro" };

function TabelaContent() {
  const { queryString, resolvedSince, resolvedUntil } = useDateFilter();
  const [data, setData] = useState<EnrichedCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    fetch(`/api/marketing/criativos-enriched?${queryString}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setData(res.data || []);
      })
      .catch(() => setError("Erro ao carregar criativos"))
      .finally(() => setLoading(false));
  }, [queryString]);

  const filtered = useMemo(() => {
    if (showInactive) return data;
    return data.filter(c => c.spend > 0);
  }, [data, showInactive]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = (a[sortField] as number) ?? (sortAsc ? Infinity : -Infinity);
      const vb = (b[sortField] as number) ?? (sortAsc ? Infinity : -Infinity);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, sortField, sortAsc]);

  const paginated = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;
  const hiddenInactive = data.filter(c => c.spend === 0).length;

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + PAGE_SIZE);
      setLoadingMore(false);
    }, 300);
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(field === "cpql" || field === "cpl"); }
  }

  // KPI summaries — only from filtered (respects period)
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalLeads = filtered.reduce((s, c) => s + c.leads_totais, 0);
  const totalQualificados = filtered.reduce((s, c) => s + c.leads_qualificados, 0);
  const avgTaxaQual = totalLeads > 0 ? (totalQualificados / totalLeads) * 100 : 0;
  const avgCpql = totalQualificados > 0 ? totalSpend / totalQualificados : 0;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (error) return <Card><CardContent className="py-12 text-center text-red-400 text-sm">{error}</CardContent></Card>;

  return (
    <div className="space-y-4">
      {/* Period indicator */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Periodo: {resolvedSince.split("-").reverse().join("/")} → {resolvedUntil.split("-").reverse().join("/")}
        </p>
        <div className="flex items-center gap-3">
          {hiddenInactive > 0 && !showInactive && (
            <button onClick={() => setShowInactive(true)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Mostrar {hiddenInactive} inativos no periodo
            </button>
          )}
          {showInactive && (
            <button onClick={() => setShowInactive(false)} className="text-[10px] text-primary hover:text-primary/80 transition-colors">
              Ocultar inativos
            </button>
          )}
          <VideoDateFilter />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Investimento Total" value={formatCurrency(totalSpend)} />
        <KpiCard label="Leads Totais" value={String(totalLeads)} />
        <KpiCard label="Leads Qualificados" value={String(totalQualificados)} />
        <KpiCard label="Taxa Qualificacao" value={formatPercent(avgTaxaQual)} />
        <KpiCard label="CPQL Medio" value={avgCpql > 0 ? formatCurrency(avgCpql) : "—"} highlight />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-2 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Thumb</TableHead>
                <TableHead>Criativo</TableHead>
                <TableHead className="w-16 text-center">Tipo</TableHead>
                <SortableHead field="spend" current={sortField} asc={sortAsc} onClick={toggleSort}>Invest.</SortableHead>
                <SortableHead field="cpl" current={sortField} asc={sortAsc} onClick={toggleSort}>CPL</SortableHead>
                <SortableHead field="leads_qualificados" current={sortField} asc={sortAsc} onClick={toggleSort}>Qualif.</SortableHead>
                <TableHead className="text-right">Taxa Qual.</TableHead>
                <SortableHead field="cpql" current={sortField} asc={sortAsc} onClick={toggleSort}>CPQL</SortableHead>
                <TableHead className="text-right">Reunioes</TableHead>
                <SortableHead field="ltv_medio" current={sortField} asc={sortAsc} onClick={toggleSort}>LTV Med.</SortableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Ret. Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground">Nenhum criativo encontrado</TableCell></TableRow>
              ) : paginated.map(c => (
                <TableRow key={c.ad_id}>
                  <TableCell className="p-2">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">{FORMAT_ICON[c.format]}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <p className="text-xs font-medium truncate">{c.ad_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.campaign_name}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px] gap-1">
                      {FORMAT_ICON[c.format]} {FORMAT_LABEL[c.format]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(c.spend)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.cpl != null ? formatCurrency(c.cpl) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{c.leads_qualificados || "—"}</TableCell>
                  <TableCell className="text-right">
                    <QualBadge value={c.taxa_qualificacao} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CpqlBadge value={c.cpql} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.reunioes_geradas || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.ltv_medio != null ? formatCurrency(c.ltv_medio) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.ctr > 0 ? formatPercent(c.ctr) : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {c.video_retention_50 != null ? formatPercent(c.video_retention_50) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <p className="text-[11px] text-muted-foreground">
              Exibindo 1–{Math.min(visibleCount, sorted.length)} de {sorted.length} criativos
            </p>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs gap-1.5"
              >
                {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                Carregar mais 20
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TabelaEnrichedTab() {
  return (
    <DateFilterProvider>
      <TabelaContent />
    </DateFilterProvider>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold", highlight && "text-primary")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SortableHead({ field, current, asc, onClick, children }: {
  field: SortField; current: SortField; asc: boolean;
  onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  const active = field === current;
  return (
    <TableHead className="text-right">
      <button onClick={() => onClick(field)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        <ArrowUpDown size={10} className={cn("text-muted-foreground", active && "text-primary")} />
      </button>
    </TableHead>
  );
}

function CpqlBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = value <= 50 ? "bg-green-500/15 text-green-400 border-green-500/30"
    : value <= 100 ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
    : value <= 200 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono ${cls}`}>{formatCurrency(value)}</span>;
}

function QualBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = value >= 50 ? "text-green-400" : value >= 30 ? "text-blue-400" : value >= 15 ? "text-yellow-400" : "text-red-400";
  return <span className={`text-xs font-mono font-semibold ${cls}`}>{formatPercent(value)}</span>;
}

