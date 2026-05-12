import { Button } from "@/components/ui/button";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function UpgradeDialog({ showUpgradeDialog, setShowUpgradeDialog }: any) {
    const navigate = useNavigate();

    if (!showUpgradeDialog) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeDialog(false)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Lock className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Nós Avançados</h3>
                        <p className="text-sm text-muted-foreground">Módulo Atendente de I.A necessário</p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Os nós avançados (Agente I.A, Enviar Resposta I.A, HTTP Request, Código e Edit Fields) fazem parte do módulo <strong>Atendente de I.A</strong>.
                    Deseja fazer upgrade do seu plano e contratar este módulo?
                </p>
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={() => { setShowUpgradeDialog(false); navigate("/meu-plano"); }} className="gap-1.5">
                        <Zap className="h-4 w-4" />
                        Ver Meu Plano
                    </Button>
                </div>
            </div>
        </div>
    );
}
