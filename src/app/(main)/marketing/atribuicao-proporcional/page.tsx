"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatNumber, formatRoas } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { AlertTriangle, Info } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CORES: Record<string, string> = {
  meta_ads_atribuido: "#22c55e",
  meta_ads_sem_atribuicao: "#ef4444",
  social_selling: "#3b82f6",
  indicacao: "#a855f7",
  organico: "#f59e0b",
  trafego_pago_outros: "#f97316",
  outros: "#6b7280",
};

const LABELS: Record<string, string> = {
  meta_ads_atribuido: "Meta Ads (com ad_id)",
  meta_ads_sem_atribuicao: "Meta Ads (sem ad_id — CTWA Fluxo B)",
  social_selling: "Social Selling",
  indicacao: "Indicacao",
  organico: "Organico",
  trafego_pago_outros: "Trafego Pago (outros)",
  outros: "Outros",
};

interface Row {
  mes_referencia: string;
  origem_categorizada: string;
  qtd_leads: number;
  pct_leads: string;
  qtd_contratos: number;
  receita_entradas: string;
  mrr_total: string;
  investimento_proporcional: string;
  roas_proporcional: string | null;
}

interface ResumoMensal {
  total_leads: number;
  total_contratos: number;
  receita_total: number;
  investimento_total: number;
  roas_cash_total: number | null;
}

export default function AtribuicaoProporcionalPage() {
  const [mesSelecionado, setMesSelecionado] = useState("2026-04");

  const { data: resp, isLoading } = useSWR<{
    data: Row[];
    resumo_mensal: Record<string, ResumoMensal>;
    nota: string;
  }>(`/api/marketing/atribuicao-proporcional?mes=${mesSelecionado}`, fetcher);

  const rows = resp?.data || [];
  const resumo = resp?.resumo_mensal?.[mesSelecionado];

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        origem: LABELS[r.origem_categorizada] || r.origem_categorizada,
        investimento: Number(r.investimento_proporcional) || 0,
        receita: Number(r.receita_entradas) || 0,
        fill: CORES[r.origem_categorizada] || "#6b7280",
      })),
    [rows]
  );

  const meses = ["2026-04", "2026-05"];

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Atribuicao Proporcional</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Distribuicao de investimento Meta por origem de leads — metrica complementar
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-200/80">
          <strong>Metrica complementar.</strong> O ROAS proporcional distribui
          o investimento Meta total pela proporcao de leads de cada origem.
          O ROAS Cash oficial (entradas / investimento) continua em{" "}
          <a href="/marketing/visao-geral" className="underline">
            /marketing
          </a>
          .
        </div>
      </div>

      {/* Seletor de mes */}
      <div className="flex gap-2">
        {meses.map((m) => (
          <button
            key={m}
            onClick={() => setMesSelecionado(m)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mesSelecionado === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <>
          {/* KPIs resumo */}
          {resumo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(resumo.total_leads)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    Total Contratos
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(resumo.total_contratos)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    Receita Entradas
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(resumo.receita_total)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    ROAS Cash Total
                  </p>
                  <p className="text-2xl font-bold">
                    {formatRoas(resumo.roas_cash_total)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Grafico bar: investimento vs receita por origem */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Investimento Proporcional vs Receita por Origem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
                      <YAxis
                        type="category"
                        dataKey="origem"
                        width={200}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "#1a1a2e",
                          border: "1px solid #333",
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="investimento"
                        name="Investimento proporcional"
                        fill="#6366f1"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="receita"
                        name="Receita entradas"
                        fill="#22c55e"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Detalhamento por Origem
                <Info className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">Origem</th>
                      <th className="text-right py-3 px-2">Leads</th>
                      <th className="text-right py-3 px-2">% Leads</th>
                      <th className="text-right py-3 px-2">Contratos</th>
                      <th className="text-right py-3 px-2">Receita</th>
                      <th className="text-right py-3 px-2">MRR</th>
                      <th className="text-right py-3 px-2">Invest. Prop.</th>
                      <th className="text-right py-3 px-2">ROAS Prop.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.origem_categorizada}
                        className="border-b border-border/50 hover:bg-muted/30"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  CORES[r.origem_categorizada] || "#6b7280",
                              }}
                            />
                            <span>
                              {LABELS[r.origem_categorizada] ||
                                r.origem_categorizada}
                            </span>
                            {r.origem_categorizada ===
                              "meta_ads_sem_atribuicao" && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5"
                              >
                                CTWA
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatNumber(r.qtd_leads)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {r.pct_leads}%
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatNumber(r.qtd_contratos)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(Number(r.receita_entradas))}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(Number(r.mrr_total))}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatCurrency(
                            Number(r.investimento_proporcional)
                          )}
                        </td>
                        <td className="text-right py-3 px-2 font-medium">
                          {formatRoas(r.roas_proporcional != null ? Number(r.roas_proporcional) : null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Comparativo ROAS */}
          {resumo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Comparativo ROAS — {mesSelecionado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rows
                    .filter(
                      (r) =>
                        r.origem_categorizada === "meta_ads_atribuido" ||
                        r.origem_categorizada === "meta_ads_sem_atribuicao"
                    )
                    .map((r) => (
                      <Card key={r.origem_categorizada} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground mb-1">
                            {LABELS[r.origem_categorizada]}
                          </p>
                          <p className="text-xl font-bold">
                            {r.roas_proporcional != null &&
                            Number(r.roas_proporcional) > 0
                              ? `${Number(r.roas_proporcional).toFixed(2)}x`
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNumber(r.qtd_contratos)} contratos /{" "}
                            {formatCurrency(Number(r.receita_entradas))}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  <Card className="bg-muted/30 border-primary/30">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        ROAS Cash Total (todas as origens)
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {formatRoas(resumo.roas_cash_total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNumber(resumo.total_contratos)} contratos /{" "}
                        {formatCurrency(resumo.receita_total)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

