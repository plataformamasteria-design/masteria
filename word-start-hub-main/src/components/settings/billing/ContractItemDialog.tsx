import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, CheckCircle, Loader2, CreditCard, Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callMP } from "../../organizations/billing/billing-utils";

export function ContractItemDialog({ open, onClose, itemType, itemKey, itemLabel, price, orgId, onSuccess }: {
    open: boolean;
    onClose: () => void;
    itemType: "module" | "connection" | "user_seat";
    itemKey: string;
    itemLabel: string;
    price: number;
    orgId: string;
    onSuccess: () => void;
}) {
    const [isActivating, setIsActivating] = useState(false);
    const [activated, setActivated] = useState(false);
    const [seatQty, setSeatQty] = useState(1);
    // Payment states
    const [step, setStep] = useState<"choose" | "paying" | "done">("choose");
    const [isGenerating, setIsGenerating] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [mpPaymentId, setMpPaymentId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const effectivePrice = itemType === "user_seat" ? price * seatQty : price;
    const requiresPayment = effectivePrice > 0;

    useEffect(() => {
        setIsActivating(false);
        setActivated(false);
        setSeatQty(1);
        setStep("choose");
        setPaymentData(null);
        setIsGenerating(false);
        setMpPaymentId(null);
    }, [open, itemKey]);

    // Poll for payment status
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!open || !mpPaymentId || step === "done") return;

        let pollCount = 0;
        pollRef.current = setInterval(async () => {
            pollCount++;
            if (pollCount > 120) {
                if (pollRef.current) clearInterval(pollRef.current);
                return;
            }
            try {
                const result = await callMP("validate_payment", { payment_id: mpPaymentId });
                if (result.status === "paid" || result.status === "approved") {
                    if (pollRef.current) clearInterval(pollRef.current);
                    // Payment confirmed — now activate
                    await doActivate();
                }
            } catch { }
        }, 5000);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [open, mpPaymentId, step]);

    const doActivate = async () => {
        setIsActivating(true);
        try {
            if (itemType === "module") {
                const { error } = await (supabase as any)
                    .from("organization_modules")
                    .upsert({
                        organization_id: orgId,
                        module_key: itemKey,
                        active: true,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: "organization_id,module_key" });
                if (error) throw error;
            } else if (itemType === "connection") {
                const { error } = await (supabase as any)
                    .from("organization_connections")
                    .upsert({
                        organization_id: orgId,
                        connection_key: itemKey,
                        active: true,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: "organization_id,connection_key" });
                if (error) throw error;
            } else if (itemType === "user_seat") {
                const { data: org } = await (supabase as any)
                    .from("organizations")
                    .select("max_users, extra_users_contracted_at")
                    .eq("id", orgId)
                    .single();
                const newMax = (org?.max_users || 3) + seatQty;
                const updateData: any = { max_users: newMax };
                if (!org?.extra_users_contracted_at) {
                    updateData.extra_users_contracted_at = new Date().toISOString();
                }
                const { error } = await (supabase as any)
                    .from("organizations")
                    .update(updateData)
                    .eq("id", orgId);
                if (error) throw error;
            }
            setActivated(true);
            setStep("done");
            toast.success(itemType === "user_seat" ? `${seatQty} usuário(s) adicionado(s)!` : `${itemLabel} ativado com sucesso!`);
            onSuccess();
        } catch (err: any) {
            toast.error("Erro ao ativar: " + (err.message || "tente novamente"));
        }
        setIsActivating(false);
    };

    const handleActivate = async () => {
        if (!requiresPayment) {
            // Free item — activate immediately
            await doActivate();
            return;
        }
        // Paid item — generate PIX payment first
        setStep("paying");
        await generatePayment();
    };

    const generatePayment = async () => {
        setIsGenerating(true);
        try {
            const description = itemType === "user_seat"
                ? `Contratação: ${seatQty} usuário(s) extra(s)`
                : `Contratação: ${itemLabel}`;

            const data = await callMP("create_payment", {
                organization_id: orgId,
                amount: effectivePrice,
                reference_month: `contract-${Date.now()}`,
                description,
                payment_method: "pix",
            });

            if (data.error) {
                toast.error(data.error);
            } else {
                setPaymentData({
                    pix_copy_paste: data.pix_qr_code,
                    pix_qr_code: data.pix_qr_code_base64,
                    payment_link: data.pix_ticket_url,
                });
                setMpPaymentId(String(data.payment_id));
                if (data.status === "approved") {
                    await doActivate();
                }
            }
        } catch {
            toast.error("Erro ao gerar pagamento");
        }
        setIsGenerating(false);
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Contratar {itemLabel}
                    </DialogTitle>
                    <DialogDescription>
                        {itemType === "user_seat"
                            ? <>Defina quantos usuários deseja adicionar.</>
                            : effectivePrice > 0
                                ? <>Valor: <span className="font-bold text-foreground">R$ {effectivePrice.toFixed(2)}</span> — pagamento único para ativação. O valor mensal será incluído nas faturas seguintes.</>
                                : <>Este item é gratuito e será ativado imediatamente.</>}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* DONE state */}
                    {step === "done" && activated ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <p className="text-lg font-bold text-foreground">
                                {itemType === "user_seat" ? `${seatQty} usuário(s) adicionado(s)!` : "Ativado com sucesso!"}
                            </p>
                            <p className="text-sm text-muted-foreground text-center">
                                {requiresPayment ? "Pagamento confirmado e recurso ativado." : "O recurso já está disponível."}
                            </p>
                            <Button onClick={onClose} className="mt-2">Fechar</Button>
                        </div>
                    ) : step === "paying" ? (
                        /* PAYING state - show PIX */
                        <>
                            {isGenerating || isActivating ? (
                                <div className="flex flex-col items-center gap-3 py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">
                                        {isActivating ? "Ativando recurso..." : "Gerando PIX..."}
                                    </p>
                                </div>
                            ) : paymentData ? (
                                <>
                                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                            ⚠️ O recurso será ativado automaticamente assim que o pagamento for confirmado.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Aguardando confirmação do pagamento...
                                    </div>

                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                                        <p className="text-xs text-muted-foreground">Valor</p>
                                        <p className="text-2xl font-bold text-primary">R$ {effectivePrice.toFixed(2)}</p>
                                    </div>

                                    {paymentData.pix_copy_paste && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium">Pix Copia e Cola:</p>
                                            <div className="flex gap-1">
                                                <Input value={paymentData.pix_copy_paste} readOnly className="text-xs font-mono h-8" />
                                                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => copyText(paymentData.pix_copy_paste)}>
                                                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {paymentData.pix_qr_code && (
                                        <div className="flex justify-center">
                                            <img src={`data:image/png;base64,${paymentData.pix_qr_code}`} alt="QR Code" className="w-40 h-40 rounded-lg border" />
                                        </div>
                                    )}
                                    {paymentData.payment_link && (
                                        <Button variant="outline" size="sm" className="w-full gap-1 text-xs" asChild>
                                            <a href={paymentData.payment_link} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3" /> Abrir Página de Pagamento
                                            </a>
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={generatePayment}>
                                        <QrCode className="h-3 w-3 mr-1" /> Gerar novo PIX
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground mb-3">Erro ao gerar pagamento</p>
                                    <Button onClick={generatePayment} className="gap-2">
                                        <QrCode className="h-4 w-4" /> Tentar novamente
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : isActivating ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Ativando...</p>
                        </div>
                    ) : (
                        /* CHOOSE state */
                        <div className="space-y-4">
                            {itemType === "user_seat" ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5">
                                        <p className="text-sm font-medium">Quantidade de usuários</p>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSeatQty(q => Math.max(1, q - 1))} disabled={seatQty <= 1}>
                                                <span className="text-lg font-bold">−</span>
                                            </Button>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={seatQty}
                                                onChange={e => setSeatQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                                className="w-16 h-8 text-center font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSeatQty(q => Math.min(100, q + 1))}>
                                                <span className="text-lg font-bold">+</span>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                                        <p className="text-xs text-muted-foreground">Custo de ativação</p>
                                        <p className="text-2xl font-bold text-primary">R$ {(price * seatQty).toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{seatQty} × R$ {price.toFixed(2)}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                                    <p className="text-lg font-bold text-primary">R$ {effectivePrice.toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {requiresPayment ? "Pagamento único para ativação + cobranças mensais" : "Ativação gratuita"}
                                    </p>
                                </div>
                            )}

                            {requiresPayment ? (
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                        💳 O recurso será ativado somente após a confirmação do pagamento via PIX.
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                        O valor mensal será incluído automaticamente nas próximas faturas.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                                        ✅ Este item é gratuito e será ativado imediatamente.
                                    </p>
                                </div>
                            )}

                            <Button onClick={handleActivate} className="gap-2 w-full">
                                {requiresPayment ? (
                                    <>
                                        <CreditCard className="h-4 w-4" /> Pagar e Ativar — R$ {effectivePrice.toFixed(2)}
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> {itemType === "user_seat" ? `Adicionar ${seatQty} Usuário${seatQty > 1 ? 's' : ''}` : "Ativar Agora"}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
