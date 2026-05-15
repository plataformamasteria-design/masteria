"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Brain, Construction } from "lucide-react";

export default function AdIntelligencePage() {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in">
      <div className="flex flex-col bg-card/40 border border-border/50 p-5 rounded-2xl">
        <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
          <Brain className="text-blue-400" size={28} />
          IA Insights
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Diagnóstico inteligente de performance de campanhas</p>
      </div>

      <Card className="border-dashed border-border/50">
        <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
          <Construction size={40} className="text-muted-foreground/40" />
          <div>
            <p className="text-lg font-bold text-foreground/80">Em Desenvolvimento</p>
            <p className="text-sm text-muted-foreground mt-1">A análise com IA estará disponível em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
