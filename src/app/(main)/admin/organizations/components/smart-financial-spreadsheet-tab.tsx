'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign, Brain, Search, RefreshCw, Calendar, TrendingUp, Filter, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMonthlyInvoices, generateOrUpdateCurrentMonthInvoices, updateInvoiceValue, updateInvoiceStatus, lockoutOverdueCompanies } from '@/app/actions/financial-invoices-actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SmartFinancialSpreadsheetTab() {
    const { toast } = useToast();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [locking, setLocking] = useState(false);
    
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadData(selectedMonth);
    }, [selectedMonth]);

    const loadData = async (month: string) => {
        setLoading(true);
        try {
            const res = await getMonthlyInvoices(month);
            if (res.success && res.data) {
                setInvoices(res.data);
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        toast({ title: 'Sincronizando IA...', description: 'Calculando tokens e gerando faturas.' });
        try {
            const res = await generateOrUpdateCurrentMonthInvoices();
            if (res.success) {
                toast({ title: 'Sucesso', description: 'Faturas e tokens atualizados.' });
                loadData(selectedMonth);
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleLockout = async () => {
        setLocking(true);
        try {
            const res = await lockoutOverdueCompanies();
            if (res.success) {
                toast({ title: 'Sucesso', description: res.message });
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } finally {
            setLocking(false);
        }
    };

    const handleChangeStatus = async (id: string, newStatus: 'PENDING' | 'PAID' | 'OVERDUE') => {
        setInvoices(prev => prev.map(inv => inv.invoice.id === id ? { ...inv, invoice: { ...inv.invoice, status: newStatus } } : inv));
        const res = await updateInvoiceStatus(id, newStatus);
        if (!res.success) {
            toast({ title: 'Erro ao atualizar status', description: res.error, variant: 'destructive' });
            loadData(selectedMonth); // revert
        } else {
            if (newStatus === 'PAID') toast({ title: 'Fatura Paga', description: 'Data de pagamento registrada.' });
        }
    };

    const handleUpdateValue = async (id: string, field: 'monthlyFee' | 'fixedCosts', valueStr: string) => {
        const value = Number(valueStr.replace(',', '.'));
        if (isNaN(value)) return;

        const res = await updateInvoiceValue(id, field, value);
        if (res.success) {
            loadData(selectedMonth);
        } else {
            toast({ title: 'Erro', description: res.error, variant: 'destructive' });
        }
    };

    const filteredInvoices = invoices.filter(inv => inv.company.name.toLowerCase().includes(search.toLowerCase()));

    const totalReceivable = filteredInvoices.reduce((acc, curr) => acc + Number(curr.invoice.totalAmount), 0);
    const totalReceived = filteredInvoices.filter(i => i.invoice.status === 'PAID').reduce((acc, curr) => acc + Number(curr.invoice.totalAmount), 0);
    const totalProfit = filteredInvoices.reduce((acc, curr) => acc + Number(curr.invoice.netProfit), 0);

    return (
        <div className="flex flex-col h-full bg-muted/5 w-full">
            <div className="p-6 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" /> 
                            Controle Financeiro Mensal
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Acompanhamento de faturamento, custo de IA e contas a receber.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={handleLockout} 
                            disabled={locking}
                            className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 font-bold tracking-wide text-xs"
                        >
                            {locking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                            Forçar Suspensão (Inadimplentes {'>10d'})
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleGenerate} 
                            disabled={generating}
                            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 font-bold tracking-wide text-xs"
                        >
                            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Processar Faturas ({selectedMonth})
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-card p-3 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar empresa..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 bg-muted/30 border-border/50 h-9"
                            />
                        </div>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px] h-9 bg-muted/30 border-border/50 font-medium text-sm">
                                <Calendar className="h-4 w-4 mr-2 opacity-50" />
                                <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={currentMonthStr}>Mês Atual ({currentMonthStr})</SelectItem>
                                <SelectItem value="2026-06">Junho 2026</SelectItem>
                                <SelectItem value="2026-05">Maio 2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-6 pr-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">A Receber Total</span>
                            <span className="font-mono font-bold">R$ {totalReceivable.toFixed(2)}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-border"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest">Recebido (Pago)</span>
                            <span className="font-mono font-bold text-emerald-500">R$ {totalReceived.toFixed(2)}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-border"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest">Lucro Líquido Prev.</span>
                            <span className="font-mono font-bold text-indigo-500">R$ {totalProfit.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-60 text-muted-foreground bg-card rounded-2xl border border-dashed">
                            <Filter className="h-10 w-10 mb-4 opacity-20" />
                            <p className="font-medium">Nenhuma fatura encontrada.</p>
                            <p className="text-sm opacity-60">Clique em "Processar Faturas" para gerar as cobranças deste mês.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vencimento</th>
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Mensalidade (Fixo)</th>
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo Variável (IA)</th>
                                        <th className="h-10 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Custo Infra</th>
                                        <th className="h-10 px-4 text-right align-middle font-semibold text-muted-foreground text-xs uppercase tracking-wider">Faturado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map((inv) => {
                                        const { invoice, company } = inv;
                                        
                                        const isLate = invoice.status === 'OVERDUE';
                                        const isPaid = invoice.status === 'PAID';
                                        
                                        return (
                                            <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted group">
                                                <td className="p-4 align-middle font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", company.active ? "bg-emerald-500" : "bg-destructive")}></div>
                                                        {company.name}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <span className={cn(
                                                        "font-mono text-xs",
                                                        isLate && "text-destructive font-bold"
                                                    )}>
                                                        {new Date(invoice.paymentDueDate).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <Select 
                                                        value={invoice.status} 
                                                        onValueChange={(val: any) => handleChangeStatus(invoice.id, val)}
                                                    >
                                                        <SelectTrigger className={cn(
                                                            "h-7 w-[120px] text-[10px] font-bold uppercase tracking-wider border-none",
                                                            isPaid && "bg-emerald-500/10 text-emerald-500",
                                                            isLate && "bg-rose-500/10 text-rose-500",
                                                            invoice.status === 'PENDING' && "bg-amber-500/10 text-amber-500"
                                                        )}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PENDING" className="text-amber-500 font-bold text-xs uppercase">Pendente</SelectItem>
                                                            <SelectItem value="PAID" className="text-emerald-500 font-bold text-xs uppercase">Pago</SelectItem>
                                                            <SelectItem value="OVERDUE" className="text-rose-500 font-bold text-xs uppercase">Atrasado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="relative w-24 group/input">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                                                        <Input 
                                                            defaultValue={Number(invoice.monthlyFee).toFixed(2)}
                                                            onBlur={(e) => handleUpdateValue(invoice.id, 'monthlyFee', e.target.value)}
                                                            className="h-8 pl-6 font-mono text-xs bg-transparent border-transparent group-hover/input:border-border hover:bg-muted/50 focus:bg-background focus:border-primary transition-all"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-500/10 w-fit">
                                                        <Brain className="h-3.5 w-3.5" />
                                                        <span className="font-mono text-xs font-bold">R$ {Number(invoice.variableCosts).toFixed(2)}</span>
                                                        <span className="text-[9px] opacity-70 ml-1">({invoice.aiTokensUsed} tk)</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="relative w-24 group/input">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                                                        <Input 
                                                            defaultValue={Number(invoice.fixedCosts).toFixed(2)}
                                                            onBlur={(e) => handleUpdateValue(invoice.id, 'fixedCosts', e.target.value)}
                                                            className="h-8 pl-6 font-mono text-xs text-rose-500 bg-transparent border-transparent group-hover/input:border-border hover:bg-muted/50 focus:bg-background focus:border-primary transition-all"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <span className={cn(
                                                        "font-mono font-black text-sm",
                                                        isPaid ? "text-emerald-500" : (isLate ? "text-rose-500" : "text-foreground")
                                                    )}>
                                                        R$ {Number(invoice.totalAmount).toFixed(2)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
