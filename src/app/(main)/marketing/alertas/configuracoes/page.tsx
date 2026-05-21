"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Threshold {
  id: string;
  tipo_alerta: string;
  threshold_value: number;
  threshold_metric: string;
  active: boolean;
  updated_at: string;
}

const LABELS: Record<string, { label: string; desc: string; unidade: string }> = {
  saturacao_frequencia: {
    label: "Frequência de Saturação",
    desc: "Frequência média acima da qual o adset é considerado saturado",
    unidade: "x",
  },
  saturacao_ctr_drop: {
    label: "Queda de CTR",
    desc: "Percentual de queda do CTR em 7 dias para classificar como crítico",
    unidade: "%",
  },
};

export default function ConfiguracoesAlertasPage() {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const fetchThresholds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/thresholds");
      if (!res.ok) throw new Error();
      const data: Threshold[] = await res.json();
      setThresholds(data);
      const vals: Record<string, string> = {};
      for (const t of data) vals[t.id] = String(t.threshold_value);
      setEditValues(vals);
    } catch {
      toast.error("Erro ao carregar thresholds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const handleSave = async (id: string) => {
    const val = parseFloat(editValues[id]);
    if (isNaN(val) || val < 0) {
      toast.error("Valor invalido");
      return;
    }
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch("/api/marketing/thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, threshold_value: val }),
      });
      if (!res.ok) throw new Error();
      toast.success("Threshold atualizado");
      setSaved((p) => ({ ...p, [id]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [id]: false })), 2000);
      setThresholds((prev) =>
        prev.map((t) => (t.id === id ? { ...t, threshold_value: val, updated_at: new Date().toISOString() } : t))
      );
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Configuracao de Alertas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina os limites para alertas automaticos de trafego
        </p>
      </div>

      <div className="space-y-3">
        {thresholds.map((t) => {
          const meta = LABELS[t.tipo_alerta] || {
            label: t.tipo_alerta,
            desc: t.threshold_metric,
            unidade: "",
          };
          const hasChanged = editValues[t.id] !== String(t.threshold_value);

          return (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{meta.label}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          t.active
                            ? "text-primary border-primary/20"
                            : "text-muted-foreground"
                        )}
                      >
                        {t.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      Metrica: {t.threshold_metric} | Atualizado:{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(t.updated_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        value={editValues[t.id] || ""}
                        onChange={(e) =>
                          setEditValues((p) => ({
                            ...p,
                            [t.id]: e.target.value,
                          }))
                        }
                        step={meta.unidade === "%" ? "1" : "0.1"}
                        className="h-8 text-sm font-mono text-right pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        {meta.unidade}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={saved[t.id] ? "outline" : "default"}
                      onClick={() => handleSave(t.id)}
                      disabled={saving[t.id] || !hasChanged}
                      className="h-8 w-8 p-0"
                    >
                      {saving[t.id] ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : saved[t.id] ? (
                        <Check size={14} className="text-primary" />
                      ) : (
                        <Save size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

