"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TableProperties, Grid2x2, Video, DollarSign, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

// Lazy imports for each view
const LazyTabelaEnriched = lazy(() => import("./_tabela-enriched"));
const LazyMatriz2x2 = lazy(() => import("./_matriz-2x2"));
const LazyRetencaoVideo = lazy(() => import("./_retencao-video"));
const LazyCohortLtv = lazy(() => import("./_cohort-ltv"));

// Keep old tabs accessible
const LazyCopyTab = lazy(() => import("./_copy-tab"));
const LazyVideoTab = lazy(() => import("./_video-tab"));

function TabFallback() {
  return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
}

const TABS = [
  { value: "tabela", label: "Tabela", icon: <TableProperties size={14} /> },
  { value: "matriz", label: "Matriz 2x2", icon: <Grid2x2 size={14} /> },
  { value: "retencao", label: "Retencao Video", icon: <Video size={14} /> },
  { value: "cohort", label: "Cohort LTV", icon: <DollarSign size={14} /> },
  { value: "copy", label: "Copy Intel", icon: <Sparkles size={14} /> },
  { value: "video", label: "Video Dashboard", icon: <Video size={14} /> },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function CriativosWithParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as TabValue) || "tabela";
  const [tab, setTab] = useState<TabValue>(initialTab);

  const handleTabChange = useCallback((value: string) => {
    setTab(value as TabValue);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Criativos</h1>
          <p className="text-sm text-muted-foreground mt-1">Analise de performance e qualidade de criativos</p>
        </div>
        <Link
          href="/marketing/anuncios"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent transition-colors"
        >
          Ir para Anuncios <ArrowRight size={12} />
        </Link>
      </div>

      {/* Tab selector */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs">
              {t.icon} {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Tab content */}
      <Suspense fallback={<TabFallback />}>
        {tab === "tabela" && <LazyTabelaEnriched />}
        {tab === "matriz" && <LazyMatriz2x2 />}
        {tab === "retencao" && <LazyRetencaoVideo />}
        {tab === "cohort" && <LazyCohortLtv />}
        {tab === "copy" && <LazyCopyTab />}
        {tab === "video" && <LazyVideoTab />}
      </Suspense>
    </div>
  );
}

export default function TrafegoCriativosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>}>
      <CriativosWithParams />
    </Suspense>
  );
}

