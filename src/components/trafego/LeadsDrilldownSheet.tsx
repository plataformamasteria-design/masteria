"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Search } from "lucide-react";
import type { FunilFilterValue } from "@/components/trafego/FunilFilter";

export type DrilldownTipo = "mql" | "sql" | "reuniao";

interface DrilldownLead {
  lead_id: string;
  nome_lead: string | null;
  etapa: string | null;
  data_lead: string | null;
  campanha_id: string | null;
  campanha_nome: string | null;
  anuncio_nome: string | null;
  conjunto_nome: string | null;
}

const TIPO_LABELS: Record<DrilldownTipo, string> = {
  mql: "Leads MQL — Marketing Qualified",
  sql: "Leads SQL — Sales Qualified",
  reuniao: "Leads com Reunião Realizada",
};

const FUNIL_LABELS: Record<string, string> = {
  todos: "Todos os Funis",
  mensagens: "Mensagens",
  formulario: "Formulário",
  webinar: "Webinar",
  landing_page: "Landing Page",
  outro: "Outro",
  nao_classificado: "Não Classificado",
};

const ETAPA_LABELS: Record<string, string> = {
  reuniao_agendada: "Reunião Agendada",
  qualificado: "MQL",
  proposta_enviada: "Proposta Enviada",
  assinatura_contrato: "Assinatura Contrato",
  comprou: "Fechado",
  no_show: "No Show",
  desistiu: "Desistiu",
  desqualificado: "Desqualificado",
  ligacao: "Ligação",
  oportunidade: "Oportunidade",
  follow_up: "Follow Up",
  remarketing: "Remarketing",
  negociacao: "Negociação",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function etapaBadgeColor(etapa: string | null): string {
  if (!etapa) return "bg-muted text-muted-foreground";
  if (["comprou", "assinatura_contrato"].includes(etapa)) return "bg-emerald-500/20 text-emerald-400";
  if (["qualificado", "reuniao_agendada", "proposta_enviada"].includes(etapa)) return "bg-blue-500/20 text-blue-400";
  if (["no_show", "desistiu", "desqualificado"].includes(etapa)) return "bg-rose-500/20 text-rose-400";
  return "bg-amber-500/20 text-amber-400";
}

function exportCSV(leads: DrilldownLead[], tipo: DrilldownTipo) {
  const headers = ["Nome", "Data de Entrada", "Campanha", "Anúncio", "Conjunto", "Status"];
  const rows = leads.map((l) => [
    l.nome_lead || "—",
    formatDate(l.data_lead),
    l.campanha_nome || "—",
    l.anuncio_nome || "—",
    l.conjunto_nome || "—",
    ETAPA_LABELS[l.etapa || ""] || l.etapa || "—",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${tipo}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LeadsDrilldownSheet({
  open,
  onClose,
  tipo,
  mesReferencia,
  funilFiltro = "todos",
}: {
  open: boolean;
  onClose: () => void;
  tipo: DrilldownTipo;
  mesReferencia: string;
  funilFiltro?: FunilFilterValue;
}) {
  const [campaignFilter, setCampaignFilter] = useState("");

  const { data, isLoading } = useSWR(
    open ? ["leads-drilldown", mesReferencia, tipo, funilFiltro] : null,
    async () => {
      const params = new URLSearchParams({ mesReferencia, tipo });
      if (funilFiltro !== "todos") params.set("funil", funilFiltro);
      const res = await fetch(`/api/marketing/leads-drilldown?${params}`);
      const json = await res.json();
      return (json.leads || []) as DrilldownLead[];
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const leads = data || [];

  // Get unique campaigns for filter
  const campaigns = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.campanha_nome) set.add(l.campanha_nome);
    }
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!campaignFilter) return leads;
    return leads.filter((l) => l.campanha_nome === campaignFilter);
  }, [leads, campaignFilter]);

  const funilLabel = FUNIL_LABELS[funilFiltro] || funilFiltro;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose(); setCampaignFilter(""); } }}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-lg font-black">
            {TIPO_LABELS[tipo]}
          </SheetTitle>
          <SheetDescription>
            {funilFiltro !== "todos" ? `${funilLabel} · ` : ""}{mesReferencia} · {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="w-full text-xs bg-transparent border border-border rounded-lg pl-8 pr-3 py-2 text-foreground"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            disabled={filteredLeads.length === 0}
            onClick={() => exportCSV(filteredLeads, tipo)}
          >
            <Download size={12} />
            CSV
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-bold text-muted-foreground">Nenhum lead encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {campaignFilter ? "Tente limpar o filtro de campanha" : "Sem dados para o período selecionado"}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-2 font-medium">Nome</th>
                  <th className="text-left py-2 pr-2 font-medium">Entrada</th>
                  <th className="text-left py-2 pr-2 font-medium">Campanha</th>
                  <th className="text-left py-2 pr-2 font-medium">Anúncio</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.lead_id} className="border-b border-border/30 hover:bg-white/[0.02]">
                    <td className="py-2 pr-2 font-medium max-w-[140px] truncate" title={lead.nome_lead || "—"}>
                      {lead.nome_lead || "—"}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(lead.data_lead)}
                    </td>
                    <td className="py-2 pr-2 max-w-[140px] truncate text-muted-foreground" title={lead.campanha_nome || "—"}>
                      {lead.campanha_nome || "—"}
                    </td>
                    <td className="py-2 pr-2 max-w-[120px] truncate text-muted-foreground" title={lead.anuncio_nome || "—"}>
                      {lead.anuncio_nome || "—"}
                    </td>
                    <td className="py-2">
                      <Badge className={`text-[9px] font-bold ${etapaBadgeColor(lead.etapa)}`}>
                        {ETAPA_LABELS[lead.etapa || ""] || lead.etapa || "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


