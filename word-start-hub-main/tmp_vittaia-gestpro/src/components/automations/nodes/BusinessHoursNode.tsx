import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const DAYS = [
    { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" },
    { key: "wed", label: "Qua" }, { key: "thu", label: "Qui" },
    { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" },
    { key: "sun", label: "Dom" },
];

function BusinessHoursNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [startTime, setStartTime] = useState(config.start_time || "08:00");
    const [endTime, setEndTime] = useState(config.end_time || "18:00");
    const [activeDays, setActiveDays] = useState<string[]>(config.active_days || ["mon", "tue", "wed", "thu", "fri"]);

    useEffect(() => { if (config.start_time) setStartTime(config.start_time); }, [config.start_time]);
    useEffect(() => { if (config.end_time) setEndTime(config.end_time); }, [config.end_time]);
    useEffect(() => { if (config.active_days) setActiveDays(config.active_days); }, [JSON.stringify(config.active_days)]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    const toggleDay = (day: string) => {
        const next = activeDays.includes(day) ? activeDays.filter((d) => d !== day) : [...activeDays, day];
        setActiveDays(next);
        update({ active_days: next });
    };

    return (
        <div className="bg-card border-2 border-cyan-500/50 rounded-xl shadow-xl min-w-[280px] overflow-visible group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Clock3 className="h-4 w-4 text-white" />}
                defaultLabel="Horário Comercial"
                customLabel={customLabel}
                colorClass="bg-gradient-to-r from-cyan-600 to-blue-600"
                textColorClass="text-white"
                solidHeader
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Abre às</Label>
                        <Input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); update({ start_time: e.target.value }); }} className="h-7 text-xs nodrag mt-1" />
                    </div>
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Fecha às</Label>
                        <Input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); update({ end_time: e.target.value }); }} className="h-7 text-xs nodrag mt-1" />
                    </div>
                </div>

                <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Dias ativos</Label>
                    <div className="flex gap-1">
                        {DAYS.map((d) => (
                            <button
                                key={d.key}
                                onClick={() => toggleDay(d.key)}
                                className={`text-[9px] font-bold px-1.5 py-1 rounded-md transition-all nodrag ${activeDays.includes(d.key)
                                        ? "bg-cyan-500 text-white shadow-sm"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Horário Comercial"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <div className="flex justify-center gap-8 px-4 pb-4 pt-2 border-t border-border/50 bg-muted/5">
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-500">✅ Dentro</span>
                    <Handle type="source" position={Position.Bottom} id="yes" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !relative !transform-none !left-auto hover:scale-125 transition-transform" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-red-400">❌ Fora</span>
                    <Handle type="source" position={Position.Bottom} id="no" className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !relative !transform-none !left-auto hover:scale-125 transition-transform" />
                </div>
            </div>
        </div>
    );
}

export const BusinessHoursNode = memo(BusinessHoursNodeComponent);
