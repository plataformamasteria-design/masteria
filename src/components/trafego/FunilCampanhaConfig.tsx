"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate as globalMutate } from "swr";

/* ── Tipos de funil ── */
export const TIPOS_FUNIL = [
  { value: "mensagens", label: "Mensagens", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  { value: "formulario", label: "Formulário", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  { value: "webinar", label: "Webinar", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  { value: "landing_page", label: "Landing Page", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  { value: "outro", label: "Outro", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
] as const;

export type TipoFunil = typeof TIPOS_FUNIL[number]["value"];

export interface FunilCampanhaRecord {
  campaign_id: string;
  campaign_name: string | null;
  tipo_funil: TipoFunil;
  atualizado_em: string;
}

/* ── SWR Key ── */
export const FUNIL_SWR_KEY = "config-funil-campanha";

/* ── Fetcher global ── */
const fetcher = () => fetch("/api/marketing/config-funil-campanha").then((r) => r.json());

/* ── Hook: useConfigFunilCampanha ── */
export function useConfigFunilCampanha() {
  const { data, error, isLoading } = useSWR<FunilCampanhaRecord[]>(FUNIL_SWR_KEY, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const mapByCampaign = new Map<string, FunilCampanhaRecord>();
  if (data && Array.isArray(data)) {
    for (const r of data) mapByCampaign.set(r.campaign_id, r);
  }

  return { records: data || [], mapByCampaign, isLoading, error };
}

/* ── Badge de tipo de funil ── */
export function FunilBadge({ tipo, size = "sm" }: { tipo: TipoFunil; size?: "sm" | "xs" }) {
  const config = TIPOS_FUNIL.find((t) => t.value === tipo);
  if (!config) return null;
  return (
    <Badge className={`${config.color} border ${size === "xs" ? "text-[8px] px-1 py-0" : "text-[10px] px-1.5 py-0.5"} font-medium`}>
      {config.label}
    </Badge>
  );
}

/* ── Popover inline para configurar funil de uma campanha ── */
export function FunilCampanhaPopover({
  campaignId,
  campaignName,
  currentTipo,
  onSaved,
}: {
  campaignId: string;
  campaignName: string;
  currentTipo?: TipoFunil | null;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TipoFunil | null>(currentTipo || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(currentTipo || null);
  }, [currentTipo]);

  const save = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/config-funil-campanha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, campaign_name: campaignName, tipo_funil: selected }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      toast.success(`Funil "${TIPOS_FUNIL.find((t) => t.value === selected)?.label}" vinculado`);
      globalMutate(FUNIL_SWR_KEY);
      onSaved?.();
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar tipo de funil");
    }
    setSaving(false);
  }, [selected, campaignId, campaignName, onSaved]);

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
        title="Configurar tipo de funil"
      >
        <Tag size={13} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 top-full left-0 mt-1 w-56 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-2 animate-in fade-in-0 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tipo de Funil</p>
            <p className="text-xs text-foreground/70 truncate" title={campaignName}>{campaignName}</p>
            <div className="space-y-1">
              {TIPOS_FUNIL.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSelected(t.value)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selected === t.value
                      ? "bg-white/[0.08] text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  }`}
                >
                  <FunilBadge tipo={t.value} size="xs" />
                  <span className="flex-1 text-left">{t.label}</span>
                  {selected === t.value && <Check size={12} className="text-primary" />}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full text-xs h-7"
              disabled={!selected || saving}
              onClick={save}
            >
              {saving ? <Loader2 size={12} className="mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

