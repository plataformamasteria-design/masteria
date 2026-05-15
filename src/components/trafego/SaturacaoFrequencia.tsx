"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SaturacaoItem {
  adset_id: string;
  adset_name: string;
  campaign_name: string;
  freq_media: number;
  ctr_medio: number;
  ctr_7d: number;
  ctr_delta_pct: number;
  spend: number;
  leads: number;
  status_alerta: "ok" | "alerta" | "critico";
}

interface SaturacaoResumo {
  freq_media_carteira: number;
  campanhas_saturadas: number;
  campanhas_criticas: number;
  total_adsets: number;
}

interface SaturacaoData {
  resumo: SaturacaoResumo;
  thresholds: { freq_limit: number; ctr_drop_limit: number };
  items: SaturacaoItem[];
}

interface SaturacaoFrequenciaProps {
  mesReferencia: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

export function SaturacaoFrequencia({ mesReferencia }: SaturacaoFrequenciaProps) {
  const [data, setData] = useState<SaturacaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/marketing/saturacao-frequencia?mes=${mesReferencia}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mesReferencia]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500" />
          <p className="text-sm text-muted-foreground mb-3">Erro ao carregar dados de saturacao</p>
          <button
            onClick={fetchData}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  const { resumo, thresholds, items } = data;

  return (
    <div className="space-y-4">
      {/* KPIs resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Freq. Media Carteira"
          value={`${resumo.freq_media_carteira.toFixed(2)}x`}
          status={resumo.freq_media_carteira > thresholds.freq_limit ? "critico" : "ok"}
        />
        <KpiCard
          label="Adsets Monitorados"
          value={String(resumo.total_adsets)}
          status="ok"
        />
        <KpiCard
          label={`Saturados (>${thresholds.freq_limit}x)`}
          value={String(resumo.campanhas_saturadas)}
          status={resumo.campanhas_saturadas > 0 ? "alerta" : "ok"}
        />
        <KpiCard
          label="Criticos (>5x)"
          value={String(resumo.campanhas_criticas)}
          status={resumo.campanhas_criticas > 0 ? "critico" : "ok"}
        />
      </div>

      {/* Tabela ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={14} />
            Ranking por Frequencia
            <Badge variant="outline" className="text-[10px] ml-auto">
              Threshold: {thresholds.freq_limit}x freq + {thresholds.ctr_drop_limit}% queda CTR
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campanha / Conjunto</TableHead>
                  <TableHead className="text-xs text-right">Freq</TableHead>
                  <TableHead className="text-xs text-right">CTR</TableHead>
                  <TableHead className="text-xs text-right">CTR 7d</TableHead>
                  <TableHead className="text-xs text-right">Invest</TableHead>
                  <TableHead className="text-xs text-right">Leads</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      Nenhum adset com dados de frequencia no periodo
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <TableRow
                    key={item.adset_id}
                    className={cn(
                      item.status_alerta === "critico" && "bg-red-500/5",
                      item.status_alerta === "alerta" && "bg-amber-500/5"
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="max-w-[300px]">
                        <p className="text-xs font-medium truncate">{item.campaign_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.adset_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      <span
                        className={cn(
                          "font-semibold",
                          item.freq_media > thresholds.freq_limit
                            ? "text-red-500"
                            : item.freq_media > thresholds.freq_limit * 0.8
                              ? "text-amber-500"
                              : "text-foreground"
                        )}
                      >
                        {item.freq_media.toFixed(2)}x
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      {(item.ctr_medio * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      <span className="inline-flex items-center gap-1">
                        {item.ctr_delta_pct !== 0 && (
                          item.ctr_delta_pct > 0 ? (
                            <TrendingUp size={10} className="text-emerald-500" />
                          ) : (
                            <TrendingDown size={10} className="text-red-500" />
                          )
                        )}
                        <span
                          className={cn(
                            item.ctr_delta_pct > 0
                              ? "text-emerald-500"
                              : item.ctr_delta_pct < -thresholds.ctr_drop_limit
                                ? "text-red-500"
                                : "text-foreground"
                          )}
                        >
                          {item.ctr_delta_pct > 0 ? "+" : ""}
                          {item.ctr_delta_pct.toFixed(1)}%
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      {fmt(item.spend)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      {item.leads}
                    </TableCell>
                    <TableCell className="text-xs text-center py-2">
                      <StatusBadge status={item.status_alerta} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "ok" | "alerta" | "critico";
}) {
  return (
    <Card
      className={cn(
        status === "critico" && "border-red-500/30",
        status === "alerta" && "border-amber-500/30"
      )}
    >
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/70 mb-1">
          {label}
        </p>
        <p
          className={cn(
            "text-lg font-bold font-mono tabular-nums",
            status === "critico" && "text-red-500",
            status === "alerta" && "text-amber-500"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "ok" | "alerta" | "critico" }) {
  if (status === "critico") {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
        Saturado
      </Badge>
    );
  }
  if (status === "alerta") {
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
        Alerta
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
      OK
    </Badge>
  );
}

