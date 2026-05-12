import React from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthScore } from "../types";

export function HealthScoreWidget({ healthScore }: { healthScore: HealthScore }) {
    return (
        <div className="col-span-2 lg:col-span-1 group relative overflow-hidden rounded-2xl border-2 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300"
            style={{ borderColor: healthScore.overall >= 80 ? 'hsl(142 76% 36% / 0.3)' : healthScore.overall >= 60 ? 'hsl(217 91% 60% / 0.3)' : healthScore.overall >= 40 ? 'hsl(38 92% 50% / 0.3)' : 'hsl(0 84% 60% / 0.3)' }}>
            <div className="p-3 md:p-4 h-full flex flex-col justify-between relative z-10 gap-3">
                <div className="flex items-center gap-1.5 xl:gap-2">
                    <Activity className={cn("h-4 w-4", healthScore.color)} />
                    <span className="text-[9px] xl:text-[10px] text-muted-foreground font-bold uppercase leading-tight tracking-wider">Health Score</span>
                </div>
                <div>
                    <p className={cn("text-4xl xl:text-5xl font-black tracking-tighter", healthScore.color)}>{healthScore.overall}</p>
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 mt-1 border-current bg-transparent tracking-widest uppercase", healthScore.color)}>
                        {healthScore.label}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
