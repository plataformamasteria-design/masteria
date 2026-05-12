import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const ROUTE_COLORS = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-amber-500",
    "bg-emerald-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500",
];

function ABTestNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [variants, setVariants] = useState<{ name: string; weight: number }[]>(
        config.variants || [
            { name: "A", weight: 50 },
            { name: "B", weight: 50 },
        ]
    );

    useEffect(() => {
        if (config.variants) setVariants(config.variants);
    }, [JSON.stringify(config.variants)]);

    const update = (newVariants: { name: string; weight: number }[]) => {
        setVariants(newVariants);
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, variants: newVariants } });
    };

    const updateVariant = (i: number, field: "name" | "weight", val: string) => {
        const next = [...variants];
        if (field === "weight") {
            next[i] = { ...next[i], weight: Math.max(0, Math.min(100, parseInt(val) || 0)) };
        } else {
            next[i] = { ...next[i], name: val.toUpperCase() };
        }
        update(next);
    };

    const addVariant = () => {
        const next = [...variants, { name: String.fromCharCode(65 + variants.length), weight: 10 }];
        update(next);
    };

    const removeVariant = (i: number) => {
        if (variants.length <= 2) return;
        update(variants.filter((_, idx) => idx !== i));
    };

    const totalWeight = variants.reduce((s, v) => s + v.weight, 0);

    return (
        <div className="bg-card border-2 border-blue-500/50 rounded-xl shadow-xl min-w-[300px] max-w-[360px] overflow-visible group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Shuffle className="h-4 w-4 text-white" />}
                defaultLabel="Teste A/B"
                customLabel={customLabel}
                colorClass="bg-gradient-to-r from-blue-600 to-purple-600"
                textColorClass="text-white"
                solidHeader
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <div className="space-y-2">
                    {variants.map((v, i) => {
                        const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
                        const pct = totalWeight > 0 ? Math.round((v.weight / totalWeight) * 100) : 0;
                        return (
                            <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <div className={`w-1.5 h-8 rounded-full ${colorClass} shrink-0`} />
                                <Input
                                    value={v.name}
                                    onChange={(e) => updateVariant(i, "name", e.target.value)}
                                    className="h-7 text-xs font-bold uppercase w-16 nodrag text-center"
                                    placeholder="A"
                                />
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={v.weight}
                                    onChange={(e) => updateVariant(i, "weight", e.target.value)}
                                    className="h-7 text-xs w-14 nodrag text-center"
                                />
                                <span className="text-[10px] text-muted-foreground w-8">{pct}%</span>
                                {variants.length > 2 && (
                                    <button onClick={() => removeVariant(i)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {totalWeight !== 100 && (
                    <p className="text-[10px] text-amber-500 font-medium">⚠️ Pesos somam {totalWeight}%, serão normalizados.</p>
                )}

                <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 border-dashed" onClick={addVariant}>
                    + Adicionar Variante
                </Button>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Teste A/B"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <div className="flex flex-wrap justify-center gap-4 px-4 pb-4 pt-2 border-t border-border/50 bg-muted/5">
                {variants.map((v, i) => {
                    const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
                    const pct = totalWeight > 0 ? Math.round((v.weight / totalWeight) * 100) : 0;
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 group/handle">
                            <span className="text-[9px] font-bold text-muted-foreground">{v.name} ({pct}%)</span>
                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id={v.name}
                                className={`!w-3 !h-3 ${colorClass.replace("bg-", "!bg-")} !border-2 !border-background !relative !transform-none !left-auto !right-auto hover:scale-125 transition-transform shadow-sm`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const ABTestNode = memo(ABTestNodeComponent);
