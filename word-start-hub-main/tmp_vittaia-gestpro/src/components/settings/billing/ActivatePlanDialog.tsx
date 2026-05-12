import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Rocket, Package, Wifi, Users } from "lucide-react";
import { MODULE_DEFINITIONS, CONNECTION_DEFINITIONS } from "@/hooks/useOrganizationModules";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPABASE_URL, ANON_KEY } from "../../organizations/billing/billing-utils";

export function ActivatePlanDialog({ open, onClose, orgId, onSuccess, getModuleBasePrice, getConnectionBasePrice, globalUserConfig, pricePerExtraUser }: {
    open: boolean;
    onClose: () => void;
    orgId: string;
    onSuccess: () => void;
    getModuleBasePrice: (key: string) => number;
    getConnectionBasePrice: (key: string) => number;
    globalUserConfig: { default_max_users: number; default_price_per_extra_user: number } | null;
    pricePerExtraUser: number;
}) {
    const [selectedModules, setSelectedModules] = useState<string[]>(["padrao"]);
    const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
    const [extraSeats, setExtraSeats] = useState(0);
    const [isActivating, setIsActivating] = useState(false);

    const globalBaseUsers = globalUserConfig?.default_max_users || 10;
    const seatPrice = pricePerExtraUser || globalUserConfig?.default_price_per_extra_user || 0;

    useEffect(() => {
        if (open) {
            setSelectedModules(["padrao"]);
            setSelectedConnections([]);
            setExtraSeats(0);
            setIsActivating(false);
        }
    }, [open]);

    const toggleModule = (key: string) => {
        if (key === "padrao") return;
        setSelectedModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const toggleConnection = (key: string) => {
        if (CONNECTION_DEFINITIONS[key]?.alwaysFree) return;
        setSelectedConnections(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
    const modulesTotal = selectedModules.reduce((sum, k) => sum + (getModuleBasePrice(k) || 0), 0);
    const connectionsTotal = selectedConnections.filter(k => !FREE_CONNECTIONS.includes(k)).reduce((sum, k) => sum + (getConnectionBasePrice(k) || 0), 0);
    const seatsTotal = extraSeats * seatPrice;
    const total = modulesTotal + connectionsTotal + seatsTotal;

    const handleActivate = async () => {
        setIsActivating(true);
        try {
            const { data, error } = await supabase.functions.invoke("subscription-api?action=activate_plan", {
                body: {
                    organization_id: orgId,
                    selected_modules: selectedModules,
                    selected_connections: selectedConnections,
                    extra_seats: extraSeats,
                },
            });

            if (error) {
                toast.error(error.message || "Erro ao ativar plano");
                setIsActivating(false);
                return;
            }
            if (data.error || data.ok === false) {
                toast.error(data.error || "Erro ao ativar plano");
            } else {
                toast.success("Fatura gerada! Pague para ativar seu plano.");
                onSuccess();
                onClose();
            }
        } catch {
            toast.error("Erro ao ativar plano");
        }
        setIsActivating(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        Ativar Plano
                    </DialogTitle>
                    <DialogDescription>
                        Escolha os módulos, conexões e usuários extras. O trial será encerrado somente após o pagamento.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Modules */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" /> Módulos
                        </h4>
                        <div className="space-y-2">
                            {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
                                const price = getModuleBasePrice(key);
                                const isSelected = selectedModules.includes(key);
                                const isRequired = key === "padrao";
                                return (
                                    <div
                                        key={key}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'}`}
                                        onClick={() => toggleModule(key)}
                                    >
                                        <Checkbox checked={isSelected} disabled={isRequired} className="pointer-events-none" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{def.label}</span>
                                                {isRequired && <Badge variant="secondary" className="text-[10px]">Obrigatório</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{def.description}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-primary shrink-0">
                                            {price > 0 ? `R$ ${price.toFixed(2)}` : 'Grátis'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Connections */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-primary" /> Conexões
                        </h4>
                        <div className="space-y-2">
                            {Object.entries(CONNECTION_DEFINITIONS).map(([key, def]) => {
                                const price = def.alwaysFree ? 0 : getConnectionBasePrice(key);
                                const isSelected = selectedConnections.includes(key) || !!def.alwaysFree;
                                return (
                                    <div
                                        key={key}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'} ${def.alwaysFree ? 'opacity-70' : ''}`}
                                        onClick={() => toggleConnection(key)}
                                    >
                                        <Checkbox checked={isSelected} disabled={!!def.alwaysFree} className="pointer-events-none" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-sm">{def.label}</span>
                                            {def.alwaysFree && <span className="text-xs text-muted-foreground ml-2">Incluso</span>}
                                        </div>
                                        <span className="text-sm font-semibold text-primary shrink-0">
                                            {price > 0 ? `R$ ${price.toFixed(2)}` : 'Grátis'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Extra Users */}
                    {seatPrice > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" /> Usuários Extras
                            </h4>
                            <div className="p-3 rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-2">
                                    Base inclusa: {globalBaseUsers} usuários. Adicione mais se necessário.
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">R$ {seatPrice.toFixed(2)}/mês por usuário</span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setExtraSeats(s => Math.max(0, s - 1))} disabled={extraSeats <= 0}>
                                            <span className="text-lg font-bold">−</span>
                                        </Button>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={extraSeats}
                                            onChange={e => setExtraSeats(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                            className="w-16 h-8 text-center font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setExtraSeats(s => Math.min(100, s + 1))}>
                                            <span className="text-lg font-bold">+</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    <div className="pt-4 border-t flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Total Mensal</p>
                            <p className="text-xs text-muted-foreground">Será cobrado na próxima fatura</p>
                        </div>
                        <p className="text-2xl font-bold text-primary">R$ {total.toFixed(2)}</p>
                    </div>

                    <Button disabled={isActivating} onClick={handleActivate} className="w-full gap-2">
                        <Rocket className="h-4 w-4" />
                        {isActivating ? "Gerando Fatura..." : "Confirmar e Ativar Plano"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
