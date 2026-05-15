"use client";

import useSWR from "swr";
import { useAdIntelligence } from "./ai-context";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

type Row = {
  nome: string;
  spend: number;
  leads: number;
  cpl: number;
  reunioes: number;
  taxa_reuniao: number;
  fechamentos: number;
  taxa_fechamento: number;
  receita: number;
  ticket_medio: number;
  roas: number;
  is_pago?: boolean;
};

type ViewMode = "midia" | "funil" | "receita";

export function CanalNichoCard() {
  const { period } = useAdIntelligence();
  const [viewMode, setViewMode] = useState<ViewMode>("midia");
  const [incluirNaoPagos, setIncluirNaoPagos] = useState(false);

  const qs = `?since=${period.since}&until=${period.until}`;
  const { data, isLoading } = useSWR(`/api/marketing/inteligencia-canal-nicho${qs}`, fetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return (
      <SpotlightCard className="p-6 border-white/5">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-zinc-500">Carregando inteligência por canal...</span>
        </div>
      </SpotlightCard>
    );
  }

  if (!data || data.error) return null;

  const canais: Row[] = data.canais || [];
  const canaisNaoPagos: Row[] = data.canais_nao_pagos || [];
  const totalLeadsNaoPagos: number = data.total_leads_nao_pagos || 0;
  const nichos: Row[] = data.nichos || [];

  const columns: Record<ViewMode, { key: keyof Row; label: string; format: (v: any) => string }[]> = {
    midia: [
      { key: "spend", label: "Spend", format: fmtMoney },
      { key: "leads", label: "Leads", format: (v) => String(v) },
      { key: "cpl", label: "CPL", format: fmtMoney },
    ],
    funil: [
      { key: "leads", label: "Leads", format: (v) => String(v) },
      { key: "taxa_reuniao", label: "→ Reunião", format: fmtPct },
      { key: "taxa_fechamento", label: "→ Fechamento", format: fmtPct },
    ],
    receita: [
      { key: "ticket_medio", label: "Ticket Médio", format: fmtMoney },
      { key: "receita", label: "Receita", format: fmtMoney },
      { key: "roas", label: "ROAS Receita", format: (v) => v ? `${v.toFixed(2)}x` : "—" },
    ],
  };

  const activeCols = columns[viewMode];

  const renderTable = (title: string, rows: Row[]) => (
    <div>
      <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-3">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-2 pr-4 text-zinc-500 font-medium" />
              {rows.map((r) => (
                <th key={r.nome} className="text-right py-2 px-3 text-zinc-400 font-semibold">
                  {r.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeCols.map((col) => (
              <tr key={col.key} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4 text-zinc-400 font-medium">{col.label}</td>
                {rows.map((r) => (
                  <td key={r.nome} className="text-right py-2 px-3 font-mono text-zinc-200">
                    {col.format(r[col.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <SpotlightCard className="p-6 border-primary/10">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">
          Inteligência por Canal e Nicho
        </h3>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5">
          {(["midia", "funil", "receita"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                viewMode === mode
                  ? "bg-primary text-black"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode === "midia" ? "Mídia" : mode === "funil" ? "Funil" : "Receita"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {canais.length > 0 && renderTable("Comparativo por Canal (Pagos)", incluirNaoPagos ? [...canais, ...canaisNaoPagos] : canais)}
        {totalLeadsNaoPagos > 0 && (
          <div className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-4 py-3">
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Leads não pagos ({totalLeadsNaoPagos})</span> — {incluirNaoPagos ? "incluídos na tabela acima" : "excluídos do CPL médio"}
              {!incluirNaoPagos && canaisNaoPagos.map((c) => (
                <span key={c.nome} className="ml-2 text-zinc-500">{c.nome}: {c.leads}</span>
              ))}
            </div>
            <button
              onClick={() => setIncluirNaoPagos(!incluirNaoPagos)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${incluirNaoPagos ? "bg-primary" : "bg-zinc-700"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${incluirNaoPagos ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>
        )}
        {nichos.length > 0 && renderTable("Comparativo por Nicho (Form Nativo)", nichos.filter((n) => n.nome !== "desconhecido" && n.nome !== "Sem UTM"))}
      </div>
    </SpotlightCard>
  );
}

