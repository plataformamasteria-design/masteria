"use client";

import { useState } from "react";
import { TabelaInteligencia } from "@/components/marketing/TabelaInteligencia";
import { DrillDownEntidade } from "@/components/marketing/DrillDownEntidade";
import type { MetricaEntidade } from "@/lib/metricas/por-entidade";

export default function ConjuntosPage() {
  const [selectedItem, setSelectedItem] = useState<MetricaEntidade | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleRowClick(item: MetricaEntidade) {
    setSelectedItem(item);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conjuntos de Anuncios</h1>
      <TabelaInteligencia nivel="adset" onRowClick={handleRowClick} />
      <DrillDownEntidade
        item={selectedItem}
        nivel="adset"
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

