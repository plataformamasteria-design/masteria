import React from "react";
import { ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function FunnelStep({ label, value, nextValue, icon: Icon, color }: {
    label: string; value: number; nextValue?: number; icon: any; color: string;
}) {
    const convRate = nextValue !== undefined && value > 0 ? ((nextValue / value) * 100).toFixed(1) : null;
    return (
        <div className="flex items-center gap-3">
            <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg shrink-0", color)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{value}</p>
            </div>
            {convRate && (
                <div className="flex items-center gap-1 shrink-0">
                    <ArrowDownRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{convRate}%</span>
                </div>
            )}
        </div>
    );
}
