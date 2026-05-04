'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign, Wallet, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCompanyFinancials, saveCompanyFinancials } from '@/app/actions/financial-actions';
import { MasterOrg } from '@/app/actions/superadmin-actions';
import { cn } from '@/lib/utils';

export function FinancialTab({ organizations }: { organizations: MasterOrg[] }) {
    const { toast } = useToast();
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [financials, setFinancials] = useState({
        monthlyFee: 0,
        implementationFee: 0,
        fixedCosts: 0,
        variableCosts: 0,
        paymentDay: 10,
        totalPaid: 0,
        lastPaymentDate: '',
    });

    useEffect(() => {
        if (selectedOrgId) {
            loadFinancials(selectedOrgId);
        }
    }, [selectedOrgId]);

    const loadFinancials = async (companyId: string) => {
        setLoading(true);
        try {
            const res = await getCompanyFinancials(companyId);
            if (res.success && res.data) {
                setFinancials({
                    monthlyFee: res.data.monthlyFee,
                    implementationFee: res.data.implementationFee,
                    fixedCosts: res.data.fixedCosts,
                    variableCosts: res.data.variableCosts,
                    paymentDay: res.data.paymentDay,
                    totalPaid: res.data.totalPaid,
                    lastPaymentDate: res.data.lastPaymentDate ? new Date(res.data.lastPaymentDate).toISOString().split('T')[0] : '',
                });
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedOrgId) return;
        setSaving(true);
        try {
            const res = await saveCompanyFinancials(selectedOrgId, financials);
            if (res.success) {
                toast({ title: 'Sucesso', description: 'Dados financeiros atualizados!' });
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: string, value: string | number) => {
        setFinancials(prev => ({ ...prev, [field]: value }));
    };

    // Cálculos de lucro
    const receitaTotal = Number(financials.monthlyFee) + Number(financials.implementationFee);
    const custoTotal = Number(financials.fixedCosts) + Number(financials.variableCosts);
    const lucro = receitaTotal - custoTotal;
    const margem = receitaTotal > 0 ? ((lucro / receitaTotal) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-2">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Controle Financeiro de Clientes</h2>
                    <p className="text-sm text-muted-foreground">Monitore mensalidades, custos de IA e o lucro real de cada tenant.</p>
                </div>
                
                <div className="w-full md:w-[300px]">
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                        <SelectTrigger className="w-full bg-background border-border/50 h-10">
                            <SelectValue placeholder="Selecione um cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {organizations.map(org => (
                                <SelectItem key={org.id} value={org.id}>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {org.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {!selectedOrgId ? (
                <div className="flex flex-col items-center justify-center p-20 border rounded-xl border-dashed bg-card/20">
                    <Wallet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold">Nenhum Cliente Selecionado</h3>
                    <p className="text-sm text-muted-foreground">Escolha uma organização no menu acima para gerenciar os custos.</p>
                </div>
            ) : loading ? (
                <div className="flex justify-center items-center p-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                    
                    {/* Formulário de Receitas e Custos */}
                    <Card className="lg:col-span-2 shadow-sm border-border/40">
                        <CardHeader className="pb-4">
                            <CardTitle>Dados do Contrato</CardTitle>
                            <CardDescription>Atualize os valores faturados e os custos operacionais.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Receitas */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-500">
                                        <TrendingUp className="h-4 w-4" /> Receitas
                                    </h4>
                                    
                                    <div className="space-y-2">
                                        <Label>Mensalidade Recorrente (R$)</Label>
                                        <Input 
                                            type="number" step="0.01" 
                                            value={financials.monthlyFee}
                                            onChange={e => handleChange('monthlyFee', e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Taxa de Implementação (R$)</Label>
                                        <Input 
                                            type="number" step="0.01" 
                                            value={financials.implementationFee}
                                            onChange={e => handleChange('implementationFee', e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Custos */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 text-rose-500">
                                        <DollarSign className="h-4 w-4" /> Custos Operacionais
                                    </h4>
                                    
                                    <div className="space-y-2">
                                        <Label>Custos Fixos da Infra (R$)</Label>
                                        <Input 
                                            type="number" step="0.01" 
                                            value={financials.fixedCosts}
                                            onChange={e => handleChange('fixedCosts', e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Custos Variáveis IA (R$)</Label>
                                        <Input 
                                            type="number" step="0.01" 
                                            value={financials.variableCosts}
                                            onChange={e => handleChange('variableCosts', e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-border/40 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label>Dia de Pagamento</Label>
                                    <Select 
                                        value={String(financials.paymentDay)} 
                                        onValueChange={v => handleChange('paymentDay', v)}
                                    >
                                        <SelectTrigger className="font-mono">
                                            <SelectValue placeholder="Dia" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[5, 10, 15, 20, 25].map(d => (
                                                <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Último Pagamento</Label>
                                    <Input 
                                        type="date" 
                                        value={financials.lastPaymentDate}
                                        onChange={e => handleChange('lastPaymentDate', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Já Pago (LTV)</Label>
                                    <Input 
                                        type="number" step="0.01" 
                                        value={financials.totalPaid}
                                        onChange={e => handleChange('totalPaid', e.target.value)}
                                        className="font-mono text-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button 
                                    onClick={handleSave} 
                                    disabled={saving}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {saving ? 'Salvando...' : 'Salvar Financeiro'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resumo de Lucratividade */}
                    <div className="space-y-6">
                        <Card className="bg-primary/5 border-primary/20 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Lucro Estimado Atual
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-1">
                                    <span className={cn(
                                        "text-4xl font-black tracking-tighter",
                                        lucro >= 0 ? "text-emerald-500" : "text-rose-500"
                                    )}>
                                        R$ {lucro.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Margem: {margem}%
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="shadow-none border-border/40">
                                <CardContent className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Faturamento</span>
                                    <span className="text-lg font-black font-mono">R$ {receitaTotal.toFixed(2)}</span>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/40">
                                <CardContent className="p-4 flex flex-col gap-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Custos</span>
                                    <span className="text-lg font-black font-mono text-rose-500">R$ {custoTotal.toFixed(2)}</span>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <Card className="shadow-none border-border/40 bg-card/50">
                            <CardContent className="p-4 flex items-start gap-3">
                                <Calendar className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">Vencimento: Dia {financials.paymentDay}</p>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        O cliente deve ser faturado no dia {financials.paymentDay}. Mantenha os custos variáveis de I.A atualizados antes de emitir a fatura.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            )}
        </div>
    );
}
