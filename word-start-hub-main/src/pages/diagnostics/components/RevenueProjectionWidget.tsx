import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmt } from "../utils";

export function RevenueProjectionWidget({ projection }: { projection: { nextMonth: number; trend: string } }) {
    if (projection.nextMonth <= 0) return null;

    return (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-xl shadow-sm overflow-hidden mt-4">
            <div className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                    <ArrowUpRight className={cn("h-6 w-6", projection.trend === 'up' ? "text-emerald-500" : projection.trend === 'down' ? "text-destructive" : "text-primary")} />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Projeção de Receita — Próximo Mês</p>
                    <p className="text-2xl font-black tracking-tight">{fmt(projection.nextMonth)}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider px-2 py-1",
                    projection.trend === 'up' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                        projection.trend === 'down' ? "text-destructive border-destructive/30 bg-destructive/10" :
                            "text-muted-foreground border-border bg-muted/50"
                )}>
                    {projection.trend === 'up' ? '📈 Crescimento' : projection.trend === 'down' ? '📉 Queda' : '➡️ Estável'}
                </Badge>
            </div>
        </div>
    );
}
