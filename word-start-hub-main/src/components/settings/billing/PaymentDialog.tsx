import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, CheckCircle, Loader2, Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callMP } from "../../organizations/billing/billing-utils";

export function PaymentDialog({ payment, open, onClose, onPaid }: { payment: any; open: boolean; onClose: () => void; onPaid?: () => void }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [mpPaymentId, setMpPaymentId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset state when payment changes
    useEffect(() => {
        setPaymentData(null);
        setIsGenerating(false);
        setIsPaid(false);
        setMpPaymentId(null);
    }, [payment?.id]);

    // Auto-generate PIX on open
    useEffect(() => {
        if (open && payment && !paymentData && !isGenerating) {
            generatePayment();
        }
    }, [open, payment?.id]);

    // Poll for payment status every 5s after PIX is generated
    useEffect(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (!open || !mpPaymentId || isPaid) return;

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
                    setIsPaid(true);
                    if (pollRef.current) clearInterval(pollRef.current);
                    toast.success("Pagamento confirmado!");
                    onPaid?.();
                }
            } catch { }
        }, 5000);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [open, mpPaymentId, isPaid]);

    const generatePayment = async () => {
        if (!payment) return;
        setIsGenerating(true);
        setIsPaid(false);
        try {
            const data = await callMP("create_payment", {
                organization_id: payment.organization_id,
                amount: Number(payment.amount),
                reference_month: payment.reference_month,
                description: `Fatura - ${payment.reference_month}`,
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
                // Check if already paid instantly (e.g. card)
                if (data.status === "approved") {
                    setIsPaid(true);
                    toast.success("Pagamento confirmado!");
                    onPaid?.();
                }
                // Update payment_history record
                await (supabase as any).from("payment_history").update({
                    pix_copy_paste: data.pix_qr_code,
                    pix_qr_code: data.pix_qr_code_base64,
                    payment_link: data.pix_ticket_url,
                    mercadopago_payment_id: String(data.payment_id),
                    payment_method: "pix",
                }).eq("id", payment.id);
                toast.success("PIX gerado com sucesso!");
            }
        } catch (err: any) {
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
                        <CreditCard className="h-5 w-5 text-primary" />
                        Pagar Fatura — {payment?.reference_month}
                    </DialogTitle>
                    <DialogDescription>
                        Valor: <span className="font-bold text-foreground">R$ {Number(payment?.amount || 0).toFixed(2)}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {isPaid ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <p className="text-lg font-bold text-foreground">Pagamento Confirmado!</p>
                            <p className="text-sm text-muted-foreground">Sua fatura foi paga com sucesso.</p>
                            <Button onClick={onClose} className="mt-2">Fechar</Button>
                        </div>
                    ) : isGenerating ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Gerando PIX...</p>
                        </div>
                    ) : paymentData ? (
                        <>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Aguardando confirmação do pagamento...
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
