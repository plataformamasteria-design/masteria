"use client";

import { AdAccountProvider } from "@/contexts/ad-account-context";
import { PeriodoTrafegoProvider, usePeriodoTrafego, type PeriodoPreset } from "@/contexts/periodo-trafego-context";
import { useAdAccount } from "@/contexts/ad-account-context";
import { TrafegoSubnav } from "@/components/trafego/TrafegoSubnav";
import { TrafegoBreadcrumb } from "@/components/trafego/TrafegoBreadcrumb";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronDown, Building2, CheckCircle2,
  Loader2, RefreshCw, AlertCircle, Megaphone,
} from "lucide-react";

// ── Period Selector ─────────────────────────────────────────────────────────────
function PeriodoSelector() {
  const { periodo, setPeriodo, dataInicio, dataFim, setDataInicio, setDataFim } = usePeriodoTrafego();

  const presets: { value: PeriodoPreset; label: string }[] = [
    { value: "7", label: "7 dias" },
    { value: "14", label: "14 dias" },
    { value: "30", label: "30 dias" },
    { value: "month", label: "Este mês" },
    { value: "90", label: "3 meses" },
  ];

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-3.5 w-3.5 text-foreground/50" />
      <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1 backdrop-blur-md">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`px-3 py-1.5 text-[11px] rounded-lg font-bold transition-all ${
              periodo === p.value
                ? "bg-white/10 text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodo === "custom" && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground"
          />
          <span className="text-foreground/30">→</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  );
}

// ── Account Bar ────────────────────────────────────────────────────────────────
function TrafegoAccountBar() {
  const { account, accounts, setAccount, isLoading, error } = useAdAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/50" />
        <span className="text-xs text-foreground/50">Carregando contas...</span>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs text-amber-300">{error || "Conecte sua conta Meta em Integrações"}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative z-20 w-fit">
      <div className="flex items-center justify-between p-1.5 pl-4 gap-6 bg-card dark:bg-card border border-black/10 dark:border-white/[0.02] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 shadow-inner">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold tracking-tight text-foreground/90">{account.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-foreground/50 font-mono">
              <span>{account.id}</span>
              <span>·</span>
              <span>{account.currency}</span>
            </div>
          </div>
        </div>

        {accounts.length > 1 && (
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.1em] px-4 py-2.5 rounded-xl transition-all duration-300 ${
              open
                ? "bg-foreground text-background shadow-md shadow-foreground/20"
                : "bg-white/5 border border-white/5 text-foreground/90 hover:text-foreground hover:bg-white/10 hover:border-white/10"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Trocar
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-3 z-50 w-80 rounded-2xl border border-white/[0.06] bg-background/80 backdrop-blur-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/90">
                Seleção de Ambiente
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {accounts.map((acc) => {
                const isSelected = acc.id === account.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setAccount(acc);
                      fetch("/api/meta/ad-accounts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ account_id: acc.id }),
                      }).catch(() => {});
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      isSelected ? "bg-primary/10" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border ${
                      isSelected ? "bg-primary/20 border-primary/30 shadow-inner" : "bg-black/20 dark:bg-white/[0.02] border-white/5"
                    }`}>
                      <Building2 className={`h-4 w-4 ${isSelected ? "text-primary" : "text-foreground/90"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold tracking-tight truncate ${isSelected ? "text-primary" : "text-foreground/80"}`}>
                        {acc.name}
                      </p>
                      <span className="text-[10px] text-foreground/50 font-mono">{acc.id}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Layout Content (needs to be inside providers) ──────────────────────────────
function MarketingLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0 md:gap-6 min-h-[calc(100vh-theme(spacing.20))]">
      {/* Sidebar de navegação interna — só desktop */}
      <aside className="hidden md:block w-52 shrink-0">
        <div className="sticky top-8 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-3">
            Tráfego Pago
          </h2>
          <TrafegoSubnav />
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0">
        <TrafegoBreadcrumb />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <PeriodoSelector />
          <TrafegoAccountBar />
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── Main Layout ────────────────────────────────────────────────────────────────
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdAccountProvider>
      <PeriodoTrafegoProvider>
        <MarketingLayoutContent>{children}</MarketingLayoutContent>

        {/* Mobile bottom bar */}
        <div className="md:hidden">
          <TrafegoSubnav />
        </div>
      </PeriodoTrafegoProvider>
    </AdAccountProvider>
  );
}

