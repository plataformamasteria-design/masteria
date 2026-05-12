import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { BarChart3, Calendar, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const DATE_RANGES = [
    { value: "7d", label: "Últimos 7 dias" },
    { value: "14d", label: "Últimos 14 dias" },
    { value: "30d", label: "Últimos 30 dias" },
    { value: "60d", label: "Últimos 60 dias" },
    { value: "90d", label: "Últimos 90 dias" },
    { value: "all", label: "Todos os dados" },
];

function MarketingNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [dateRange, setDateRange] = useState(config.date_range || "30d");

    useEffect(() => { if (config.date_range) setDateRange(config.date_range); }, [config.date_range]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<BarChart3 className="h-4 w-4 text-teal-500" />}
                defaultLabel="Dados de Marketing (Meta)"
                customLabel={customLabel}
                colorClass="bg-teal-500/10"
                textColorClass="text-teal-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <div className="p-2 rounded-lg bg-teal-500/5 border border-teal-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-3 w-3 text-teal-500" />
                        <Label className="text-[10px] font-bold text-teal-600 uppercase">Período de Análise</Label>
                    </div>
                    <Select value={dateRange} onValueChange={(v) => { setDateRange(v); update({ date_range: v }); }}>
                        <SelectTrigger className="h-7 text-xs nodrag">
                            <SelectValue placeholder="Selecionar período" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGES.map((r) => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-teal-500/5 border border-teal-500/10">
                    <div className="flex items-center gap-2">
                        <Target className="h-3 w-3 text-teal-500" />
                        <Label className="text-[10px] font-bold text-teal-600 uppercase">Incluir Metas KPI</Label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer nodrag">
                        <input
                            type="checkbox"
                            checked={config.include_kpis || false}
                            onChange={(e) => update({ include_kpis: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-300 peer-checked:bg-teal-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Consulta campanhas Meta do período selecionado e injeta no contexto.</p>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />

            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Dados de Marketing"}
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned || false}
                isExecuting={(data as any)?.isExecuting || false}
                onExecute={() => (data as any)?.onExecute?.(id)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-background" />
        </div>
    );
}

export const MarketingNode = memo(MarketingNodeComponent);
