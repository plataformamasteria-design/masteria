import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, AlertTriangle, CreditCard, Zap, History, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentRecord, STATUS_CONFIG, PAYMENT_TYPE_LABELS } from "./billing-utils";

export function PaymentHistorySection() {
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [orgs, setOrgs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterOrg, setFilterOrg] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        let query = (supabase as any)
            .from("payment_history")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500);

        if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
        if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

        const [paymentsRes, orgsRes] = await Promise.all([
            query,
            (supabase as any).from("organizations").select("id, name, lifetime").order("name"),
        ]);
        // Filter out lifetime org payments from history
        const lifetimeOrgIds = new Set((orgsRes.data || []).filter((o: any) => o.lifetime).map((o: any) => o.id));
        setPayments((paymentsRes.data || []).filter((p: any) => !lifetimeOrgIds.has(p.organization_id)));
        setOrgs((orgsRes.data || []).filter((o: any) => !o.lifetime));
        setIsLoading(false);
    }, [dateFrom, dateTo]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (isLoading) return <Skeleton className="h-64" />;

    const filtered = payments.filter(p => {
        if (filterStatus !== "all" && p.status !== filterStatus) return false;
        if (filterOrg !== "all" && p.organization_id !== filterOrg) return false;
        if (filterType !== "all" && p.payment_type !== filterType) return false;
        return true;
    });

    const totalReceived = filtered.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const totalPending = filtered.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const totalMensalidade = filtered.filter(p => p.payment_type === "mensalidade" && p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const totalTokens = filtered.filter(p => p.payment_type !== "mensalidade" && p.status === "paid").reduce((s, p) => s + p.amount, 0);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <div>
                                <p className="text-[10px] text-muted-foreground">Total Recebido</p>
                                <p className="text-lg font-bold text-green-600">R$ {totalReceived.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <div>
                                <p className="text-[10px] text-muted-foreground">Total Pendente</p>
                                <p className="text-lg font-bold text-yellow-600">R$ {totalPending.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                            <div>
                                <p className="text-[10px] text-muted-foreground">Mensalidades</p>
                                <p className="text-lg font-bold text-blue-600">R$ {totalMensalidade.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-violet-500/20 bg-violet-500/5">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-violet-600" />
                            <div>
                                <p className="text-[10px] text-muted-foreground">Tokens</p>
                                <p className="text-lg font-bold text-violet-600">R$ {totalTokens.toFixed(2)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        Histórico Completo
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="space-y-1">
                            <Label className="text-xs">De</Label>
                            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Até</Label>
                            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Tipo</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-40 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="mensalidade">Mensalidade</SelectItem>
                                    <SelectItem value="token_chatgpt">Token ChatGPT</SelectItem>
                                    <SelectItem value="token_gemini">Token Gemini</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-36 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="paid">Pago</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="failed">Falhou</SelectItem>
                                    <SelectItem value="cancelled">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Organização</Label>
                            <Select value={filterOrg} onValueChange={setFilterOrg}>
                                <SelectTrigger className="w-48 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {orgs.map(o => (
                                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Atualizar
                            </Button>
                            {(dateFrom || dateTo) && (
                                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs">
                                    Limpar datas
                                </Button>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">{filtered.length} registro(s) encontrado(s)</p>

                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mês</TableHead>
                                        <TableHead>Organização</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Método</TableHead>
                                        <TableHead>Data Pgto</TableHead>
                                        <TableHead>MP ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((p) => {
                                        const org = orgs.find(o => o.id === p.organization_id);
                                        const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                                        const StatusIcon = sc.icon;
                                        const typeInfo = PAYMENT_TYPE_LABELS[p.payment_type] || PAYMENT_TYPE_LABELS.mensalidade;

                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium">{p.reference_month}</TableCell>
                                                <TableCell className="text-sm">{org?.name || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`text-[10px] ${typeInfo.color}`}>
                                                        {typeInfo.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">R$ {Number(p.amount).toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={sc.badgeVariant} className="gap-1">
                                                        <StatusIcon className="h-3 w-3" />
                                                        {sc.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{p.payment_method || "—"}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString("pt-BR") : "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {p.mercadopago_payment_id ? `#${p.mercadopago_payment_id}` : "—"}
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
        </div>
    );
}
