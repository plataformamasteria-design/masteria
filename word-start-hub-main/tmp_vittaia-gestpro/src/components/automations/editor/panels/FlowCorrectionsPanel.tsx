import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Search, Check } from "lucide-react";
import { NODE_LABELS } from "../registry";

export function FlowCorrectionsPanel({ flowCorrections, setFlowCorrections, nodes, setNodes, setHighlightedNodeId, setCenter, showSimulator }: any) {
    if (flowCorrections.length === 0 || showSimulator) return null;

    return (
        <Panel position="top-right" className="!m-4 z-50 w-80">
            <div className="bg-card border border-amber-500/30 rounded-xl p-0 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)] overflow-hidden">
                <div className="bg-amber-500/10 px-4 py-3 flex items-center justify-between border-b border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-500">
                        <Sparkles className="h-4 w-4" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">Magia da Correção ({flowCorrections.length})</h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/20" onClick={() => setFlowCorrections([])}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
                <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
                    {flowCorrections.map((corr: any, idx: number) => {
                        const node = nodes.find((n: any) => n.id === corr.nodeId);
                        return (
                            <div key={idx} className="bg-background rounded-lg border border-border p-3 space-y-2 relative group transition-all hover:border-amber-500/30">
                                {corr.nodeId && node && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0">
                                        <Search className="h-3 w-3 cursor-pointer hover:text-amber-400 transition-colors" onClick={() => {
                                            setHighlightedNodeId(corr.nodeId);
                                            setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 800 });
                                            setTimeout(() => setHighlightedNodeId(null), 3000);
                                        }} title="Focar no Nó" />
                                        <span>Ref: {NODE_LABELS[node.type || ""] || "Nó"}</span>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground font-medium">{corr.reason}</p>

                                <div className="bg-muted/50 p-2 rounded-md border border-border/50 text-[10px] text-foreground/80 break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    <span className="text-amber-500 font-semibold mb-1 block">Sugestão I.A ({corr.type === 'add_node' ? 'Inserir Nó' : corr.field || 'Geral'}):</span>
                                    {corr.suggestion}
                                </div>

                                <div className="flex gap-2 pt-1">
                                    {corr.type === "update_node" && corr.nodeId && corr.field && (
                                        <Button size="sm" className="w-full text-[10px] h-7 gap-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                                            setNodes((nds: any) => nds.map((n: any) => {
                                                if (n.id === corr.nodeId) {
                                                    return { ...n, data: { ...n.data, config: { ...(n.data.config as any), [corr.field!]: corr.suggestion } } };
                                                }
                                                return n;
                                            }));
                                            setFlowCorrections((prev: any) => prev.filter((_: any, i: number) => i !== idx));
                                        }}>
                                            <Check className="h-3 w-3" /> Aprovar Magia
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7 gap-1 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setFlowCorrections((prev: any) => prev.filter((_: any, i: number) => i !== idx))}>
                                        <X className="h-3 w-3" /> Ignorar
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Panel>
    );
}
