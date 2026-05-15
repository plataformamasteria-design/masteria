"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, lazy, Suspense } from "react";
import { AdIntelligenceProvider, useAdIntelligence } from "./_components/ai-context";
import { AdIntelligenceHeader } from "./_components/ai-header";
import { AdIntelligenceTabs } from "./_components/ai-tabs";

import { OverviewTab } from "./_components/overview";
import { RecommendationsTab, BenchmarkTab } from "./_components/other-tabs";
import { EstrategiaTab } from "./_components/estrategia-tab";

const LazyAlertasPage = lazy(() => import("@/app/(main)/marketing/alertas/_alertas-content"));

function AdIntelligenceActiveView() {
  const { activeTab } = useAdIntelligence();

  return (
    <div className="mt-6 flex-1 min-h-0 bg-transparent flex flex-col">
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "recomendacoes" && <RecommendationsTab />}
      {activeTab === "benchmark" && <BenchmarkTab />}
      {activeTab === "alertas" && (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando alertas...</p></div>}>
          <LazyAlertasPage />
        </Suspense>
      )}
      {activeTab === "estrategia" && <EstrategiaTab />}
    </div>
  );
}

function TabFromUrl() {
  const searchParams = useSearchParams();
  const { setActiveTab } = useAdIntelligence();
  const urlTab = searchParams.get("tab");

  useEffect(() => {
    if (urlTab === "alertas" || urlTab === "recomendacoes" || urlTab === "benchmark" || urlTab === "overview" || urlTab === "estrategia") {
      setActiveTab(urlTab);
    }
  }, [urlTab, setActiveTab]);

  return null;
}

export default function AdIntelligencePage() {
  return (
    <AdIntelligenceProvider>
      <div className="flex flex-col min-h-full pb-20">
        <Suspense fallback={null}><TabFromUrl /></Suspense>
        <AdIntelligenceHeader />
        <div className="mt-4">
          <AdIntelligenceTabs />
        </div>
        <AdIntelligenceActiveView />
      </div>
    </AdIntelligenceProvider>
  );
}


