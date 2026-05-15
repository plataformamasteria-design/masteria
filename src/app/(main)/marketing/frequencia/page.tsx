"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Clock } from "lucide-react";
import { usePeriodoTrafego } from "@/contexts/periodo-trafego-context";
import { SaturacaoFrequencia } from "@/components/trafego/SaturacaoFrequencia";
import { HorarioLeads } from "@/components/trafego/HorarioLeads";

export default function FrequenciaPage() {
  const { dataInicio, dataFim } = usePeriodoTrafego();

  // Extrair mes do dataInicio para a API de saturacao
  const mesReferencia = dataInicio.slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analise de Frequencia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Saturacao de anuncios e distribuicao temporal de leads
        </p>
      </div>

      <Tabs defaultValue="saturacao">
        <TabsList>
          <TabsTrigger value="saturacao" className="gap-1.5">
            <TrendingUp size={14} />
            Saturacao
          </TabsTrigger>
          <TabsTrigger value="horario" className="gap-1.5">
            <Clock size={14} />
            Horario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saturacao" className="mt-4">
          <SaturacaoFrequencia mesReferencia={mesReferencia} />
        </TabsContent>

        <TabsContent value="horario" className="mt-4">
          <HorarioLeads dataInicio={dataInicio} dataFim={dataFim} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


