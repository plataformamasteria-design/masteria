import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    FileText, RefreshCw, DollarSign, CheckCircle, Clock, XCircle, Receipt,
    Building2, QrCode, Copy, Check, ExternalLink, Landmark, Edit
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    PaymentRecord,
    callMP,
    calculateOrgTotal,
    STATUS_CONFIG
} from "./billing-utils";

export function InvoicesSection() {
    const [referenceMonth, setReferenceMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUpdatingAmounts, setIsUpdatingAmounts] = useState(false);
    const [isMarkingAllPaid, setIsMarkingAllPaid] = useState(false);
    const [markAllPaidOrg, setMarkAllPaidOrg] = useState("");
    const [orgs, setOrgs] = useState<any[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sendingLink, setSendingLink] = useState<string | null>(null);
    const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
    const [editDraft, setEditDraft] = useState({ amount: "", due_date: "", notes: "" });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const [orgsRes, paymentsRes] = await Promise.all([
            (supabase as any).from("organizations").select("id, name, slug, active, lifetime").order("name"),
            (supabase as any).from("payment_history").select("*").eq("reference_month", referenceMonth).order("created_at", { ascending: false }),
        ]);
        setOrgs(orgsRes.data || []);
        // Filter out payments from lifetime orgs
        const lifetimeOrgIds = new Set((orgsRes.data || []).filter((o: any) => o.lifetime).map((o: any) => o.id));
        setPayments((paymentsRes.data || []).filter((p: any) => !lifetimeOrgIds.has(p.organization_id)));
        setIsLoading(false);
    }, [referenceMonth]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleGenerateInvoices = async () => {
        setIsGenerating(true);
        try {
            const result = await callMP("generate_invoices", { reference_month: referenceMonth });
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`${result.created} faturas geradas para ${referenceMonth}`);
                await fetchData();
            }
        } catch (err: any) {
            toast.error(err.message);
        }
        setIsGenerating(false);
    };

    // Recalculate amounts for all PENDING invoices using current org prices
    const handleUpdateAmounts = async () => {
        setIsUpdatingAmounts(true);
        try {
            const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "failed");
            if (pendingPayments.length === 0) {
                toast.info("Nenhuma fatura pendente para atualizar");
                setIsUpdatingAmounts(false);
                return;
            }

            let updated = 0;
            for (const p of pendingPayments) {
                const newTotal = await calculateOrgTotal(p.organization_id);
                if (newTotal > 0 && newTotal !== p.amount) {
                    const { error } = await (supabase as any)
                        .from("payment_history")
                        .update({ amount: newTotal, updated_at: new Date().toISOString() })
                        .eq("id", p.id);
                    if (!error) updated++;
                }
            }

            toast.success(`${updated} fatura(s) atualizada(s) com valores correntes`);
            await fetchData();
        } catch (err: any) {
            toast.error(err.message);
        }
        setIsUpdatingAmounts(false);
    };

    // Mark all pending invoices of a specific org as paid
    const handleMarkAllPaid = async () => {
        if (!markAllPaidOrg) {
            toast.error("Selecione uma organização");
            return;
        }
        setIsMarkingAllPaid(true);
        try {
            const { data, error } = await (supabase as any)
                .from("payment_history")
                .update({ status: "paid", payment_date: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("organization_id", markAllPaidOrg)
                .in("status", ["pending", "failed"])
                .select("id");

            if (error) {
                toast.error("Erro ao marcar faturas como pagas");
            } else {
                const count = data?.length || 0;
                toast.success(`${count} fatura(s) marcada(s) como paga(s)`);
                // Reactivate org if it was deactivated
                await (supabase as any).from("organizations").update({ active: true }).eq("id", markAllPaidOrg);
                await fetchData();
            }
        } catch (err: any) {
            toast.error(err.message);
        }
        setIsMarkingAllPaid(false);
    };

    const handleCreatePaymentLink = async (orgId: string, amount: number) => {
        setSendingLink(orgId);
        try {
            const result = await callMP("create_preference", {
                organization_id: orgId,
                amount,
                reference_month: referenceMonth,
                description: `Assinatura Vitta - ${referenceMonth}`,
            });
            if (result.preference_url) {
                window.open(result.preference_url, "_blank");
                toast.success("Link de pagamento gerado");
                await fetchData();
            } else {
                toast.error(result.error || "Erro ao gerar link");
            }
        } catch (err: any) {
            toast.error(err.message);
        }
        setSendingLink(null);
    };

    const handleUpdateStatus = async (paymentId: string, newStatus: string) => {
        const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === "paid") updateData.payment_date = new Date().toISOString();
        if (newStatus === "cancelled") updateData.payment_date = null;

        const { error } = await (supabase as any)
            .from("payment_history")
            .update(updateData)
            .eq("id", paymentId);

        if (error) {
            toast.error("Erro ao atualizar status");
        } else {
            toast.success("Status atualizado");
            await fetchData();
        }
    };

    const openEditPayment = (payment: PaymentRecord) => {
        setEditingPayment(payment);
        setEditDraft({
            amount: String(payment.amount),
            due_date: payment.due_date ? payment.due_date.slice(0, 10) : "",
            notes: (payment as any).notes || "",
        });
    };

    const handleSaveEdit = async () => {
        if (!editingPayment) return;
        const updateData: any = {
            amount: Number(editDraft.amount),
            due_date: editDraft.due_date || null,
            notes: editDraft.notes || null,
            updated_at: new Date().toISOString(),
        };

        const { error } = await (supabase as any)
            .from("payment_history")
            .update(updateData)
            .eq("id", editingPayment.id);

        if (error) {
            toast.error("Erro ao atualizar fatura");
        } else {
            toast.success("Fatura atualizada");
            setEditingPayment(null);
            await fetchData();
        }
    };

    if (isLoading) return <Skeleton className="h-64" />;

    const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const totalFailed = payments.filter(p => p.status === "failed").reduce((s, p) => s + p.amount, 0);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Gerenciar Faturas
                    </CardTitle>
                    <CardDescription>Gere faturas mensais e acompanhe pagamentos de todas as organizações</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Mês de Referência</Label>
                            <Input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} className="w-48" />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button onClick={handleGenerateInvoices} disabled={isGenerating} className="gap-2">
                                <FileText className="h-4 w-4" />
                                {isGenerating ? "Gerando..." : "Gerar Faturas"}
                            </Button>
                            <Button variant="outline" onClick={fetchData} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Atualizar
                            </Button>
                            <Button variant="outline" onClick={handleUpdateAmounts} disabled={isUpdatingAmounts} className="gap-2">
                                <DollarSign className="h-4 w-4" />
                                {isUpdatingAmounts ? "Recalculando..." : "Recalcular Pendentes"}
                            </Button>
                        </div>
                    </div>

                    {/* Mark all paid per org */}
                    <div className="flex flex-col sm:flex-row items-end gap-2 p-3 rounded-lg bg-muted/50 border">
                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <Label className="text-xs">Marcar todas as faturas pendentes como pagas</Label>
                            <Select value={markAllPaidOrg} onValueChange={setMarkAllPaidOrg}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecione a organização..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgs.filter(o => !o.lifetime).map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="default"
                            onClick={handleMarkAllPaid}
                            disabled={isMarkingAllPaid || !markAllPaidOrg}
                            className="gap-2"
                        >
                            <CheckCircle className="h-4 w-4" />
                            {isMarkingAllPaid ? "Processando..." : "Marcar Todas como Pagas"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                                <p className="text-xs text-muted-foreground">Recebido</p>
                                <p className="text-lg font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-yellow-600" />
                            <div>
                                <p className="text-xs text-muted-foreground">Pendente</p>
                                <p className="text-lg font-bold text-yellow-600">R$ {totalPending.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <XCircle className="h-5 w-5 text-destructive" />
                            <div>
                                <p className="text-xs text-muted-foreground">Falhou/Vencido</p>
                                <p className="text-lg font-bold text-destructive">R$ {totalFailed.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Faturas — {referenceMonth}</CardTitle>
                </CardHeader>
                <CardContent>
                    {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhuma fatura para este mês. Clique em "Gerar Faturas" para criar.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Organização</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Pagamento</TableHead>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Boleto/PIX</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map((p) => {
                                        const org = orgs.find(o => o.id === p.organization_id);
                                        const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                                        const StatusIcon = sc.icon;

                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <span className="font-medium text-sm">{org?.name || "—"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">R$ {Number(p.amount).toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={sc.badgeVariant} className="gap-1">
                                                        <StatusIcon className="h-3 w-3" />
                                                        {sc.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString("pt-BR") : "—"}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {p.pix_copy_paste && (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                                                        <QrCode className="h-3 w-3" /> PIX
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-72 space-y-2">
                                                                    <p className="text-xs font-medium">Pix Copia e Cola:</p>
                                                                    <div className="flex gap-1">
                                                                        <Input value={p.pix_copy_paste} readOnly className="text-xs font-mono h-7" />
                                                                        <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => { navigator.clipboard.writeText(p.pix_copy_paste!); toast.success("Copiado!"); }}>
                                                                            <Copy className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                    {p.pix_qr_code && (
                                                                        <div className="flex justify-center">
                                                                            <img src={`data:image/png;base64,${p.pix_qr_code}`} alt="QR Code" className="w-40 h-40 rounded border" />
                                                                        </div>
                                                                    )}
                                                                    {p.payment_link && (
                                                                        <Button variant="outline" size="sm" className="w-full gap-1 text-xs" asChild>
                                                                            <a href={p.payment_link} target="_blank" rel="noopener noreferrer">
                                                                                <ExternalLink className="h-3 w-3" /> Página do Pix
                                                                            </a>
                                                                        </Button>
                                                                    )}
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                        {p.boleto_url && (
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                                                                <a href={p.boleto_url} target="_blank" rel="noopener noreferrer">
                                                                    <Landmark className="h-3 w-3" /> Boleto
                                                                </a>
                                                            </Button>
                                                        )}
                                                        {!p.pix_copy_paste && !p.boleto_url && (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1"
                                                            onClick={() => openEditPayment(p)}
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                        {p.status !== "paid" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-xs gap-1"
                                                                disabled={sendingLink === p.organization_id}
                                                                onClick={() => handleCreatePaymentLink(p.organization_id, p.amount)}
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                                Link
                                                            </Button>
                                                        )}
                                                        <Select value={p.status} onValueChange={(val) => handleUpdateStatus(p.id, val)}>
                                                            <SelectTrigger className="h-7 w-28 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="paid">Pago</SelectItem>
                                                                <SelectItem value="pending">Pendente</SelectItem>
                                                                <SelectItem value="failed">Falhou</SelectItem>
                                                                <SelectItem value="cancelled">Cancelado</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Payment Dialog */}
            <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Fatura</DialogTitle>
                        <DialogDescription>
                            Altere valor, vencimento e observações desta fatura
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={editDraft.amount}
                                onChange={(e) => setEditDraft(d => ({ ...d, amount: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Data de Vencimento</Label>
                            <Input
                                type="date"
                                value={editDraft.due_date}
                                onChange={(e) => setEditDraft(d => ({ ...d, due_date: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                value={editDraft.notes}
                                onChange={(e) => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                                placeholder="Notas internas sobre esta cobrança..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPayment(null)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit}>Salvar Alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
