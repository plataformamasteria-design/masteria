"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HORAS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`);

interface HorarioLeadsProps {
  dataInicio: string;
  dataFim: string;
}

export function HorarioLeads({ dataInicio, dataFim }: HorarioLeadsProps) {
  const [leads, setLeads] = useState<Array<{ hora_chegada: number; dia_semana: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data } = await supabase
        .from("leads_ads_attribution")
        .select("hora_chegada,dia_semana")
        .gte("created_at", dataInicio + "T00:00:00")
        .lte("created_at", dataFim + "T23:59:59");
      setLeads((data || []) as Array<{ hora_chegada: number; dia_semana: number }>);
      setLoading(false);
    }
    loadData();
  }, [dataInicio, dataFim]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxVal = 0;
  leads.forEach((l) => {
    if (l.dia_semana >= 0 && l.dia_semana <= 6 && l.hora_chegada >= 0 && l.hora_chegada <= 23) {
      grid[l.dia_semana][l.hora_chegada]++;
      maxVal = Math.max(maxVal, grid[l.dia_semana][l.hora_chegada]);
    }
  });

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum lead com dados de horario no periodo
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Heatmap — Dia da Semana x Hora do Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <div className="min-w-[700px]">
            <div className="flex">
              <div className="w-10 shrink-0" />
              {HORAS.map((h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground py-1">
                  {h}
                </div>
              ))}
            </div>
            {DIAS.map((dia, di) => (
              <div key={dia} className="flex">
                <div className="w-10 shrink-0 text-xs text-muted-foreground flex items-center justify-end pr-2">
                  {dia}
                </div>
                {Array.from({ length: 24 }, (_, hi) => {
                  const val = grid[di][hi];
                  const opacity = maxVal > 0 ? Math.max(0.05, val / maxVal) : 0;
                  return (
                    <div
                      key={hi}
                      className="flex-1 aspect-square m-[1px] rounded-sm flex items-center justify-center text-[9px] font-medium"
                      style={{
                        backgroundColor:
                          val > 0
                            ? `rgba(24, 95, 165, ${opacity})`
                            : "rgba(255,255,255,0.03)",
                        color:
                          opacity > 0.5
                            ? "white"
                            : opacity > 0
                              ? "rgba(24, 95, 165, 0.8)"
                              : "transparent",
                      }}
                      title={`${dia} ${HORAS[hi]}: ${val} leads`}
                    >
                      {val > 0 ? val : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
          <span>Menos</span>
          {[0.1, 0.3, 0.5, 0.7, 1].map((o) => (
            <div
              key={o}
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: `rgba(24, 95, 165, ${o})` }}
            />
          ))}
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  );
}
