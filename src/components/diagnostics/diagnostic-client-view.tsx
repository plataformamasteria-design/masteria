'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import {
    Users, DollarSign, Target, RefreshCw, MessageSquare, Heart, CheckCircle2, XCircle
} from 'lucide-react';
import { getMonthlyDiagnostics, syncDiagnosticsMonth, saveDiagnostics } from '@/app/actions/lead-diagnostics';
import { cn } from '@/lib/utils';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

export function DiagnosticClientView() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const { toast } = useToast();

    const fetchData = async () => {
        setLoading(true);
        try {
            const dbData = await getMonthlyDiagnostics(selectedYear);

            // Ensure all 12 months present
            const months = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${(i + 1).toString().padStart(2, "0")}`);
            const mappedData = months.map(m => {
                const found = dbData.find(d => d.referenceMonth === m);
                return found || {
                    referenceMonth: m, totalLeads: 0, meetingsScheduled: 0, meetingsDone: 0,
                    noShow: 0, contractsWon: 0, ltvTotal: 0, adSpend: 0, commissionRate: 10,
                    campaignImpressions: 0, campaignClicks: 0, campaignConversions: 0
                };
            });
            setData(mappedData);
        } catch (error) {
            toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const handleSyncAll = async () => {
        setLoading(true);
        try {
            const syncs = await Promise.all(data.map(d => syncDiagnosticsMonth(d.referenceMonth)));
            // Merge with manual fields (adSpend, etc)
            const merged = data.map((d, i) => {
                const s = syncs[i];
                return {
                    ...d,
                    totalLeads: s.totalLeads,
                    meetingsScheduled: s.meetingsScheduled,
                    meetingsDone: s.meetingsDone,
                    noShow: s.noShow,
                    contractsWon: s.contractsWon,
                    ltvTotal: s.ltvTotal,
                    campaignImpressions: s.campaignImpressions,
                    campaignClicks: s.campaignClicks,
                    campaignConversions: s.campaignConversions
                };
            });
            setData(merged);
            toast({ title: 'Dados sicronizados via Database!' });

            // Auto save after sync
            await saveDiagnostics(merged);
        } catch (e) {
            console.error(e);
            toast({ title: 'Erro na sincronização', variant: 'destructive' });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveDiagnostics(data);
            toast({ title: 'Métricas salvas com sucesso!' });
        } catch (e) {
            toast({ title: 'Erro', variant: 'destructive' });
        }
        setSaving(false);
    };

    const updateField = (idx: number, field: string, val: string) => {
        const num = parseFloat(val) || 0;
        const newData = [...data];
        newData[idx] = { ...newData[idx], [field]: num };
        setData(newData);
    };

    // Dashboard Aggregates
    const totals = data.reduce((acc, d) => ({
        leads: acc.leads + (Number(d.totalLeads) || 0),
        won: acc.won + (Number(d.contractsWon) || 0),
        spend: acc.spend + (Number(d.adSpend) || 0),
        ltv: acc.ltv + (Number(d.ltvTotal) || 0),
    }), { leads: 0, won: 0, spend: 0, ltv: 0 });

    const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Diagnóstico de Leads
                    </h1>
                    <p className="text-muted-foreground mt-1">Visão analítica de funil e métricas financeiras</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Input
                        type="number"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-24"
                    />
                    <Button onClick={handleSyncAll} disabled={loading} variant="secondary">
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Sincronizar DB
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Salvar Edições
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="glass border-white/10 dark:bg-neutral-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
                        <Users className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.leads}</div>
                        <p className="text-xs text-muted-foreground mt-1">Ano inteiro selecionado</p>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10 dark:bg-neutral-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Fechamentos (Won)</CardTitle>
                        <Target className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.won}</div>
                        <p className="text-xs text-muted-foreground mt-1">Taxa: {totals.leads ? ((totals.won / totals.leads) * 100).toFixed(1) : 0}%</p>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10 dark:bg-neutral-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ad Spend (Reais)</CardTitle>
                        <DollarSign className="w-4 h-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{fmtCurrency(totals.spend)}</div>
                        <p className="text-xs text-muted-foreground mt-1">CPA: {totals.won ? fmtCurrency(totals.spend / totals.won) : 0}</p>
                    </CardContent>
                </Card>
                <Card className="glass border-white/10 dark:bg-neutral-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Receita Bruta (LTV)</CardTitle>
                        <Heart className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{fmtCurrency(totals.ltv)}</div>
                        <p className="text-xs text-muted-foreground mt-1">ROAS: {totals.spend ? (totals.ltv / totals.spend).toFixed(2) : 0}x</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="glass border-white/10 dark:bg-neutral-900/50">
                <CardHeader>
                    <CardTitle>Histórico e Evolução Mensal</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                <XAxis dataKey="referenceMonth" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }}
                                />
                                <Bar dataKey="totalLeads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="contractsWon" name="Fechados" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="glass border-white/10 dark:bg-neutral-900/50">
                <CardHeader>
                    <CardTitle>Tabela de Metas Embutida (Editor Rápido)</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 rounded-lg">
                            <tr>
                                <th className="px-4 py-3">Mês</th>
                                <th className="px-4 py-3">Leads</th>
                                <th className="px-4 py-3 text-green-500">Wins</th>
                                <th className="px-4 py-3">Receita</th>
                                <th className="px-4 py-3 text-red-500">Ad Spend (Digitar)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {data.map((d, i) => (
                                <tr key={d.referenceMonth} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 font-medium">{d.referenceMonth}</td>
                                    <td className="px-4 py-3">{d.totalLeads}</td>
                                    <td className="px-4 py-3">{d.contractsWon}</td>
                                    <td className="px-4 py-3">{fmtCurrency(d.ltvTotal)}</td>
                                    <td className="px-4 py-3 max-w-[120px]">
                                        <Input
                                            type="number"
                                            value={d.adSpend || ''}
                                            onChange={(e) => updateField(i, 'adSpend', e.target.value)}
                                            className="h-8 shadow-none bg-background/50"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

        </div>
    );
}
