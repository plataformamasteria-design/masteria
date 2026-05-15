"use client";

import { Suspense } from "react";
import TrafegoAlertasPage from "./_alertas-content";

export default function AlertasPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando alertas...</p></div>}>
        <TrafegoAlertasPage />
      </Suspense>
    </div>
  );
}
