"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { invalidateConfigMqlSql } from "@/lib/metricas/mql-sql";
import { toast } from "sonner";
import { Save, Loader2, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Todas as etapas existentes em leads_crm.etapa */
const TODAS_ETAPAS = [
  { value: "qualificado", label: "Qualificado" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "ligacao", label: "Ligacao" },
  { value: "reuniao_agendada", label: "Reuniao Agendada" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "assinatura_contrato", label: "Assinatura Contrato" },
  { value: "comprou", label: "Comprou" },
  { value: "no_show", label: "No Show" },
  { value: "follow_up", label: "Follow Up" },
  { value: "remarketing", label: "Remarketing" },
  { value: "desistiu", label: "Desistiu" },
  { value: "desqualificado", label: "Desqualificado" },
] as const;

function EtapaCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left w-full",
        checked
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
          : "border-border/40 bg-transparent hover:bg-muted/20"
      )}
    >
      <div
        className={cn(
          "h-4 w-4 shrink-0 rounded border transition-colors flex items-center justify-center",
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/40"
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4 7L8 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export function ConfigMqlSql() {
  const [mqlSet, setMqlSet] = useState<Set<string>>(new Set());
  const [sqlSet, setSqlSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("config_funil_etapas")
        .select("etapa, classificacao")
        .eq("ativo", true);

      if (error) throw error;

      const mql = new Set<string>();
      const sql = new Set<string>();
      for (const row of data || []) {
        if (row.classificacao === "MQL") mql.add(row.etapa);
        else if (row.classificacao === "SQL") sql.add(row.etapa);
      }
      setMqlSet(mql);
      setSqlSet(sql);
    } catch (e) {
      toast.error("Erro ao carregar config MQL/SQL");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleMql = (etapa: string) => {
    setMqlSet((prev) => {
      const next = new Set(prev);
      if (next.has(etapa)) next.delete(etapa);
      else next.add(etapa);
      return next;
    });
  };

  const toggleSql = (etapa: string) => {
    setSqlSet((prev) => {
      const next = new Set(prev);
      if (next.has(etapa)) next.delete(etapa);
      else next.add(etapa);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Deletar config atual
      const { error: delError } = await supabase
        .from("config_funil_etapas")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all

      if (delError) throw delError;

      // Inserir novas
      const rows: { etapa: string; classificacao: string; ativo: boolean }[] = [];
      for (const etapa of mqlSet) {
        rows.push({ etapa, classificacao: "MQL", ativo: true });
      }
      for (const etapa of sqlSet) {
        rows.push({ etapa, classificacao: "SQL", ativo: true });
      }

      if (rows.length > 0) {
        const { error: insError } = await supabase
          .from("config_funil_etapas")
          .insert(rows);
        if (insError) throw insError;
      }

      invalidateConfigMqlSql();
      toast.success("Configuracao MQL/SQL salva com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || String(e)));
    }
    setSaving(false);
  };

  return (
    <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg">
      <CardHeader
        className="bg-muted/10 border-b border-border/30 cursor-pointer select-none"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Filter size={14} />
            Configuracao MQL / SQL
            <Badge variant="outline" className="text-[9px] ml-2">
              {mqlSet.size} MQL / {sqlSet.size} SQL
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Defina quais etapas do pipeline GHL representam MQL (Marketing Qualified Lead) e SQL (Sales Qualified Lead).
                Uma etapa pode pertencer a ambas as classificacoes simultaneamente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MQL Column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] font-bold uppercase tracking-widest">
                      MQL
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Marketing Qualified Lead
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {TODAS_ETAPAS.map((e) => (
                      <EtapaCheckbox
                        key={`mql-${e.value}`}
                        checked={mqlSet.has(e.value)}
                        onToggle={() => toggleMql(e.value)}
                        label={e.label}
                      />
                    ))}
                  </div>
                </div>

                {/* SQL Column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest">
                      SQL
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Sales Qualified Lead
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {TODAS_ETAPAS.map((e) => (
                      <EtapaCheckbox
                        key={`sql-${e.value}`}
                        checked={sqlSet.has(e.value)}
                        onToggle={() => toggleSql(e.value)}
                        label={e.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg uppercase tracking-widest text-[10px] h-10 font-black"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} className="mr-2" />
                    Salvar Configuracao
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
