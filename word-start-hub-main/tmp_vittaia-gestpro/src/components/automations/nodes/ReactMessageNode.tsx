import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Heart } from "lucide-react";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const EMOJI_OPTIONS = ["👍", "❤️", "🔥", "😂", "😮", "😢", "🙏", "👏", "✅", "🎉", "💯", "😍"];

function ReactMessageNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [emoji, setEmoji] = useState(config.emoji || "👍");

    useEffect(() => { if (config.emoji) setEmoji(config.emoji); }, [config.emoji]);

    const selectEmoji = (e: string) => {
        setEmoji(e);
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, emoji: e } });
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[240px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Heart className="h-4 w-4 text-pink-500" />}
                defaultLabel="Reagir à Mensagem"
                customLabel={customLabel}
                colorClass="bg-pink-500/10"
                textColorClass="text-pink-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <div className="text-center">
                    <span className="text-4xl transition-transform hover:scale-125 cursor-default inline-block">{emoji}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                    {EMOJI_OPTIONS.map((e) => (
                        <button
                            key={e}
                            onClick={() => selectEmoji(e)}
                            className={`text-xl p-1.5 rounded-lg transition-all nodrag ${emoji === e
                                    ? "bg-pink-500/20 ring-2 ring-pink-500 scale-110"
                                    : "hover:bg-muted/50 hover:scale-105"
                                }`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Reage à última mensagem recebida do lead</p>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Reagir"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-pink-500 !border-2 !border-background" />
        </div>
    );
}

export const ReactMessageNode = memo(ReactMessageNodeComponent);
