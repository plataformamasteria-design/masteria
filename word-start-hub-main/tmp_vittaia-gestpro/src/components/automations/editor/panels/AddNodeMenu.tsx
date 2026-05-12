import { Button } from "@/components/ui/button";
import { Lock, X } from "lucide-react";
import { NODE_CATEGORIES } from "../registry";

export function AddNodeMenu({
    pendingConnection,
    setPendingConnection,
    addNodeAtPosition,
    setShowUpgradeDialog,
    canUseAIAutomation,
}: any) {
    if (!pendingConnection) return null;

    return (
        <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl w-72 max-h-[70vh] overflow-y-auto"
            style={{
                left: Math.min(pendingConnection.x, window.innerWidth - 300),
                top: Math.min(pendingConnection.y, window.innerHeight - 400),
            }}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card z-10">
                <span className="text-xs font-semibold text-muted-foreground">Adicionar Nó</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPendingConnection(null)}>
                    <X className="h-3 w-3" />
                </Button>
            </div>
            {NODE_CATEGORIES.map((category: any) => {
                const isLocked = category.locked && !canUseAIAutomation;
                return (
                    <div key={category.label}>
                        <div className="px-3 py-1.5 bg-muted/40 border-b border-border/50 flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{category.label}</span>
                            {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        {isLocked ? (
                            <button
                                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors text-left"
                                onClick={() => {
                                    setPendingConnection(null);
                                    setShowUpgradeDialog(true);
                                }}
                            >
                                <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <Lock className="h-3 w-3 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-medium">Módulo Atendente de I.A</p>
                                    <p className="text-[9px] text-muted-foreground">Contrate para desbloquear</p>
                                </div>
                            </button>
                        ) : (
                            category.items.map((opt: any) => (
                                <button
                                    key={opt.type}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                                    onClick={() => {
                                        addNodeAtPosition(
                                            opt.type,
                                            pendingConnection.x,
                                            pendingConnection.y,
                                            pendingConnection.sourceNodeId,
                                            pendingConnection.sourceHandleId
                                        );
                                        setPendingConnection(null);
                                    }}
                                >
                                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                        <opt.icon className="h-3 w-3 text-primary" />
                                    </div>
                                    <span className="text-[12px] font-medium">{opt.label}</span>
                                </button>
                            ))
                        )}
                    </div>
                );
            })}
        </div>
    );
}
