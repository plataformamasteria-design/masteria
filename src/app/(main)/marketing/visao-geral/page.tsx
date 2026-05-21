"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { useAccountSpend } from "@/hooks/use-account-spend";
import { useAdAccount } from "@/contexts/ad-account-context";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { toast } from "sonner";
import {
  DollarSign, Users, TrendingUp, BarChart3, Target,
  Layers, ArrowRight, Loader2, Megaphone, MousePointerClick, Eye, RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (type === "percent") return `${n.toFixed(2)}%`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// ── KPI Card ────────────────────────────────────────────────────────────────────
function KPICard({ label, value, subtitle, icon: Icon, isPrimary, color }: {
  label: string; value: string; subtitle?: string;
  icon: React.ElementType; isPrimary?: boolean; color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`${isPrimary ? "bg-card/60 backdrop-blur-md" : "bg-card/30"} border overflow-hidden relative group hover:border-primary/30 transition-all`}>
        <CardContent className={isPrimary ? "p-5" : "p-4"}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon size={isPrimary ? 16 : 14} className={color || "text-muted-foreground/60"} />
              <span className={`${isPrimary ? "text-[10px]" : "text-[9px]"} uppercase font-bold text-muted-foreground tracking-widest`}>{label}</span>
            </div>
          </div>
          <p className={`${isPrimary ? "text-3xl" : "text-xl"} font-black tracking-tight`}>{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Quick Action Card ───────────────────────────────────────────────────────────
function QuickAction({ href, label, description, icon: Icon, color }: {
  href: string; label: string; description: string; icon: React.ElementType; color: string;
}) {
  return (
    <Link href={href}>
      <Card className="bg-card/30 border hover:border-primary/30 hover:bg-card/50 transition-all group cursor-pointer">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${color} shrink-0`}>
            <Icon size={18} className="text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────────
export default function VisaoGeralPage() {
  const { dataInicio, dataFim } = usePeriodoTrafego();
  const { account } = useAdAccount();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    totalSpend, totalLeads, totalImpressions, totalClicks,
    isLoading: spendLoading,
  } = useAccountSpend(dataInicio, dataFim);

  // Campanhas overview
  const acctParam = account?.id ? `&account_id=${account.id}` : "";
  const { data: campData, isLoading: campLoading } = useSWR(
    account?.id ? `/api/meta/campanhas?since=${dataInicio}&until=${dataFim}${acctParam}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const campanhas = campData?.campanhas || [];
  const activeCamps = campanhas.filter((c: any) => c.effective_status === "ACTIVE").length;
  const isLoading = spendLoading || campLoading;

  // Derived metrics
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/meta/cache-clear", { method: "POST" });
      await mutate(
        (key) => typeof key === "string" && key.includes("/api/meta/"),
        undefined,
        { revalidate: true }
      );
      toast.success("Dados sincronizados com o Meta Ads.");
    } catch (e) {
      toast.error("Falha ao sincronizar dados.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in zoom-in">
        <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Carregando dados de tráfego...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-card/40 border border-border/50 p-5 rounded-2xl">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">Cockpit Executivo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão Global · Sincronização de <span className="text-foreground font-bold">{dataInicio}</span> a <span className="text-foreground font-bold">{dataFim}</span></p>
        </div>
        <div className="flex items-center gap-3 mt-3 md:mt-0">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-primary/20 hover:bg-primary/10 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            {isRefreshing ? "Sincronizando..." : "Sincronizar Meta"}
          </Button>

          {activeCamps > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary">{activeCamps} ativa{activeCamps > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Investimento"
          value={fmt(totalSpend, "currency")}
          subtitle={`${dataInicio} a ${dataFim}`}
          icon={DollarSign}
          isPrimary
          color="text-accent"
        />
        <KPICard
          label="Leads"
          value={fmt(totalLeads)}
          subtitle={cpl > 0 ? `CPL: ${fmt(cpl, "currency")}` : undefined}
          icon={Users}
          isPrimary
          color="text-primary"
        />
        <KPICard
          label="Impressões"
          value={fmt(totalImpressions)}
          subtitle={cpm > 0 ? `CPM: ${fmt(cpm, "currency")}` : undefined}
          icon={Eye}
          color="text-violet-400"
        />
        <KPICard
          label="Cliques"
          value={fmt(totalClicks)}
          subtitle={ctr > 0 ? `CTR: ${fmt(ctr, "percent")} · CPC: ${fmt(cpc, "currency")}` : undefined}
          icon={MousePointerClick}
          color="text-amber-400"
        />
      </div>

      {/* KPIs Secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="CPL" value={cpl > 0 ? fmt(cpl, "currency") : "—"} icon={Target} color="text-rose-400" />
        <KPICard label="CTR" value={ctr > 0 ? fmt(ctr, "percent") : "—"} icon={TrendingUp} color="text-cyan-400" />
        <KPICard label="CPC" value={cpc > 0 ? fmt(cpc, "currency") : "—"} icon={MousePointerClick} color="text-orange-400" />
        <KPICard label="Campanhas Ativas" value={String(activeCamps)} icon={Layers} color="text-accent" />
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase font-black tracking-widest text-muted-foreground">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction
            href="/marketing/gerenciar"
            label="Gerenciar Campanhas"
            description="Pausar, ativar, editar e criar campanhas"
            icon={Megaphone}
            color="bg-accent"
          />
          <QuickAction
            href="/marketing/campanhas"
            label="Análise de Campanhas"
            description="Métricas detalhadas por campanha"
            icon={BarChart3}
            color="bg-violet-600"
          />
          <QuickAction
            href="/marketing/criativos"
            label="Análise de Criativos"
            description="Performance por criativo e formato"
            icon={Target}
            color="bg-primary"
          />
        </div>
      </div>

      {/* Top Campanhas */}
      {campanhas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-black tracking-widest text-muted-foreground">Top Campanhas</h2>
            <Link href="/marketing/gerenciar" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {campanhas.slice(0, 5).map((c: any, i: number) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-card/20 border hover:border-primary/20 transition-all">
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        c.effective_status === "ACTIVE" ? "bg-primary" : "bg-zinc-500"
                      }`} />
                      <span className="text-xs font-medium text-foreground truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-[11px] text-muted-foreground">
                      <span>{fmt(c.spend || 0, "currency")}</span>
                      <span>{c.leads || 0} leads</span>
                      <span>{c.cpl ? fmt(c.cpl, "currency") : "—"} CPL</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

