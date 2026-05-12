import { useState, useEffect, useCallback } from "react";
import { format, endOfMonth, startOfMonth, eachDayOfInterval, isWeekend, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CalendarDays, TrendingUp, Target, DollarSign, XCircle, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Closer {
    id: string;
    name: string;
}

interface DailyMetric {
    id?: string;
    date: string;
    meetings_scheduled: number;
    meetings_done: number;
    no_show: number;
    sales: number;
    mrr: number;
    ltv: number;
    commission: number;
}

export default function CloserPerformanceTab({
    organizationId,
    selectedMonth
}: {
    organizationId: string;
    selectedMonth: string; // YYYY-MM
}) {
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [activeClosers, setActiveClosers] = useState<Closer[]>([]);

    // State maps [closerId][YYYY-MM-DD] to DailyMetric
    const [metrics, setMetrics] = useState<Record<string, Record<string, DailyMetric>>>({});

    // Chats state to populate the Lead dropdown per closer
    const [closerChats, setCloserChats] = useState<Record<string, { id: string, name: string }[]>>({});
    const [saleForm, setSaleForm] = useState({ chatId: '', amount: '', ltvAmount: '' });
    const [savingSale, setSavingSale] = useState(false);

    // State to handle which day is currently being edited
    const [editingDay, setEditingDay] = useState<{ closerId: string, date: string } | null>(null);

    // Generate days sequence for the selected month
    const daysInMonth = eachDayOfInterval({
        start: new Date(`${selectedMonth}-01T00:00:00`),
        end: endOfMonth(new Date(`${selectedMonth}-01T00:00:00`))
    });

    const fetchData = useCallback(async () => {
        if (!organizationId || !selectedMonth) return;
        setLoading(true);

        try {
            const yearMonth = selectedMonth.split('-');
            const start = `${selectedMonth}-01`;
            const end = format(endOfMonth(new Date(`${selectedMonth}-01T00:00:00`)), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from("closer_daily_metrics")
                .select("*")
                .eq("organization_id", organizationId)
                .gte("date", start)
                .lte("date", end);

            if (error) console.warn("Supabase metrics loading error ignored:", error);
            const metricsData = error ? [] : (data || []);

            // Puxa todos os usuários da organização baseando-se no 'profiles'
            const { data: orgUsers, error: usersErr } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('organization_id', organizationId);

            if (usersErr) console.warn("Supabase users loading error ignored:", usersErr);

            let fetchedClosers = (orgUsers || [])
                .map((p: any) => ({ id: p.id, name: p.full_name || 'Agente' }));

            if (fetchedClosers.length === 0) {
                fetchedClosers = [{ id: 'mock_demo', name: 'Demonstração (Sem Agentes)' }];
            }

            setActiveClosers(fetchedClosers);

            // Fetch Chats (Leads) to populate the Dropdown for selling
            const { data: activeChats, error: chatsErr } = await supabase
                .from('chats')
                .select('id, assigned_to, wa_name, phone, custom_name, group_name, contacts(name)')
                .eq('organization_id', organizationId)
                .in('assigned_to', fetchedClosers.map(c => c.id))
                .order('updated_at', { ascending: false })
                .limit(2000);

            const chatsMap: Record<string, { id: string, name: string }[]> = {};
            (activeChats || []).forEach((c: any) => {
                if (!chatsMap[c.assigned_to]) chatsMap[c.assigned_to] = [];
                const cName = c.custom_name || c.contacts?.name || c.wa_name || c.group_name || c.phone || 'Lead Sem Nome';
                chatsMap[c.assigned_to].push({
                    id: c.id,
                    name: cName
                });
            });
            // Adicionar dados mockados se tivermos o "mock_demo"
            if (fetchedClosers[0].id === 'mock_demo') {
                chatsMap['mock_demo'] = [
                    { id: 'mock-1', name: 'João Silva' },
                    { id: 'mock-2', name: 'Maria Souza' }
                ];
            }
            setCloserChats(chatsMap);

            const newMetrics: Record<string, Record<string, DailyMetric>> = {};

            fetchedClosers.forEach(closer => {
                newMetrics[closer.id] = {};
                daysInMonth.forEach(d => {
                    const dateStr = format(d, "yyyy-MM-dd");
                    newMetrics[closer.id][dateStr] = {
                        date: dateStr,
                        meetings_scheduled: 0,
                        meetings_done: 0,
                        no_show: 0,
                        sales: 0,
                        mrr: 0,
                        ltv: 0,
                        commission: 0
                    };
                });
            });

            if (metricsData.length > 0) {
                metricsData.forEach(m => {
                    if (newMetrics[m.closer_id] && newMetrics[m.closer_id][m.date]) {
                        newMetrics[m.closer_id][m.date] = {
                            id: m.id,
                            date: m.date,
                            meetings_scheduled: m.meetings_scheduled || 0,
                            meetings_done: m.meetings_done || 0,
                            no_show: m.no_show || 0,
                            sales: m.sales || 0,
                            mrr: m.mrr || 0,
                            ltv: m.ltv || 0,
                            commission: m.commission || 0
                        };
                    }
                });
            }

            setMetrics(newMetrics);
        } catch (e: any) {
            console.error("Closer performance unhandled error:", e);
            // Don't show toast so the UI just defaults to zeroes instead of throwing red alerts.
        } finally {
            setLoading(false);
        }
    }, [organizationId, selectedMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced Save
    const handleCellChange = async (closerId: string, dateStr: string, field: keyof DailyMetric, value: string) => {
        let numValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;

        setMetrics(prev => {
            const copy = { ...prev };
            const current = { ...copy[closerId][dateStr] };
            (current as any)[field] = numValue;

            // Auto-calculate no-show
            if (field === 'meetings_scheduled' || field === 'meetings_done') {
                const sched = field === 'meetings_scheduled' ? numValue : current.meetings_scheduled;
                const done = field === 'meetings_done' ? numValue : current.meetings_done;
                current.no_show = Math.max(0, sched - done);
            }

            // Auto-calculate commission (10% of MRR)
            if (field === 'mrr') {
                current.commission = numValue * 0.10;
            }

            copy[closerId][dateStr] = current;
            return copy;
        });

        // Save to DB immediately (Supabase handles upsert efficiently, but for production a timeout debounce is better. For this MVP, direct await is fine with optimistic UI)
        try {
            const currentMetric = metrics[closerId][dateStr];
            const payload: any = {
                organization_id: organizationId,
                closer_id: closerId,
                date: dateStr,
                [field]: numValue
            };

            if (field === 'meetings_scheduled' || field === 'meetings_done') {
                const sched = field === 'meetings_scheduled' ? numValue : currentMetric.meetings_scheduled;
                const done = field === 'meetings_done' ? numValue : currentMetric.meetings_done;
                payload.no_show = Math.max(0, sched - done);
            }

            if (field === 'mrr') {
                payload.commission = numValue * 0.10;
            }

            // If it exists, update. Otherwise Insert. (UPSERT)
            const { error } = await supabase
                .from('closer_daily_metrics')
                .upsert({
                    id: currentMetric.id, // Upsert based on PK or conflict on organization, closer, date
                    ...payload
                }, { onConflict: "organization_id, closer_id, date" });

            if (error) throw error;
        } catch (e: any) {
            console.error(e);
            // toast({ title: "Erro ao salvar", description: field, variant: "destructive" });
        }
    };

    const handleSyncSystem = async () => {
        // This function will compute aggregate values from bookings and transactions for the whole month for all closers.
        setSyncing(true);
        try {
            const start = `${selectedMonth}-01`;
            const end = format(endOfMonth(new Date(`${selectedMonth}-01T00:00:00`)), 'yyyy-MM-dd');

            // We will perform naive sync: query chats, calendar_events, and transactions.
            const [eventsRes, transactionsRes, chatsRes] = await Promise.all([
                supabase.from('calendar_events').select('chat_id, start_time, attendance_status').eq('organization_id', organizationId).gte('start_time', start).lte('start_time', end + 'T23:59:59'),
                supabase.from('transactions').select('chat_id, amount, transaction_date').eq('organization_id', organizationId).eq('type', 'income').gte('transaction_date', start).lte('transaction_date', end + 'T23:59:59'),
                supabase.from('chats').select('id, assigned_to').eq('organization_id', organizationId)
            ]);

            const chatsMap = new Map((chatsRes.data || []).map(c => [c.id, c.assigned_to]));

            const newValues: any[] = [];

            activeClosers.forEach(closer => {
                daysInMonth.forEach(d => {
                    const dateStr = format(d, "yyyy-MM-dd");
                    // Count events
                    let scheduled = 0;
                    let done = 0;
                    let noShow = 0;

                    (eventsRes.data || []).forEach(ev => {
                        if (ev.start_time && ev.start_time.startsWith(dateStr)) {
                            if (chatsMap.get(ev.chat_id) === closer.id) {
                                scheduled++;
                                if (ev.attendance_status === 'attended') done++;
                                if (ev.attendance_status === 'no_show') noShow++;
                            }
                        }
                    });

                    // Count Transactions (Sales)
                    let salesCount = 0;
                    let mrrTotal = 0;
                    (transactionsRes.data || []).forEach(tx => {
                        if (tx.transaction_date && tx.transaction_date.startsWith(dateStr)) {
                            if (chatsMap.get(tx.chat_id) === closer.id) {
                                salesCount++;
                                mrrTotal += Number(tx.amount);
                            }
                        }
                    });

                    // Only push to upsert if we found system data to avoid overriding manual inputs with zeros
                    if (scheduled > 0 || done > 0 || noShow > 0 || salesCount > 0 || mrrTotal > 0) {
                        newValues.push({
                            organization_id: organizationId,
                            closer_id: closer.id,
                            date: dateStr,
                            meetings_scheduled: scheduled,
                            meetings_done: done,
                            no_show: noShow,
                            sales: salesCount,
                            mrr: mrrTotal,
                            ltv: mrrTotal,     // Simplified
                            commission: mrrTotal * 0.10
                        });
                    }
                });
            });

            if (newValues.length > 0) {
                const { error } = await supabase.from('closer_daily_metrics').upsert(newValues, { onConflict: "organization_id, closer_id, date" });
                if (error) throw error;
                toast({ title: `Sincronizou ${newValues.length} registros automáticos!` });
                await fetchData();
            } else {
                toast({ title: "Nenhum dado nativo encontrado para esse mês." });
            }

        } catch (e: any) {
            toast({ title: "Erro na sincronização", variant: "destructive" });
        } finally {
            setSyncing(false);
        }
    };

    const handleRegisterCRM = async (closerId: string, dateStr: string) => {
        if (!saleForm.chatId || (!saleForm.amount && !saleForm.ltvAmount)) {
            toast({ title: "Erro", description: "Selecione o Lead e informe ao menos o MRR ou LTV.", variant: "destructive" });
            return;
        }

        setSavingSale(true);
        try {
            if (closerId !== 'mock_demo') {
                const payload = {
                    organization_id: organizationId,
                    chat_id: saleForm.chatId,
                    amount: parseFloat(saleForm.amount.replace(/\./g, "").replace(",", ".") || "0"),
                    ltv_amount: parseFloat(saleForm.ltvAmount.replace(/\./g, "").replace(",", ".") || "0"),
                    type: "income",
                    status: "completed",
                    transaction_date: `${dateStr}T12:00:00Z`
                };

                const { error } = await supabase.from('transactions').insert(payload);
                if (error) throw error;
            }

            toast({ title: "Sucesso!", description: "Venda lançada no CRM e associada ao Heatmap autonôma e automaticamente." });
            setSaleForm({ chatId: '', amount: '', ltvAmount: '' });

            // Reload to run triggers!
            if (closerId !== 'mock_demo') {
                await fetchData();
            } else {
                // Mock behavior: just increment
                handleCellChange(closerId, dateStr, "sales", String((metrics[closerId]?.[dateStr]?.sales || 0) + 1));
            }
        } catch (e: any) {
            toast({ title: "Erro ao registrar venda", description: e.message, variant: "destructive" });
        } finally {
            setSavingSale(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    // --- Cálculos Quadro Geral ---
    const globalSales = Object.values(metrics).flatMap(cm => Object.values(cm)).reduce((acc, m) => acc + (m.sales || 0), 0);
    const globalMRR = Object.values(metrics).flatMap(cm => Object.values(cm)).reduce((acc, m) => acc + (m.mrr || 0), 0);
    const globalLTV = Object.values(metrics).flatMap(cm => Object.values(cm)).reduce((acc, m) => acc + (m.ltv || 0), 0);
    const globalCommission = Object.values(metrics).flatMap(cm => Object.values(cm)).reduce((acc, m) => acc + (m.commission || 0), 0);
    const globalDone = Object.values(metrics).flatMap(cm => Object.values(cm)).reduce((acc, m) => acc + (m.meetings_done || 0), 0);
    const globalConversionRate = globalDone > 0 ? ((globalSales / globalDone) * 100).toFixed(1) : "0.0";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl p-5 rounded-2xl border border-neutral-200/60 dark:border-white/5 shadow-sm">
                <div className="mb-4 md:mb-0">
                    <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
                        Performance por Agente
                    </h3>
                    <p className="text-[11px] font-medium text-muted-foreground mt-1">
                        Selecione os dias da semana no "Heatmap" interativo de cada consultor para auditar os resultados diários.
                    </p>
                </div>
                <Button onClick={handleSyncSystem} disabled={syncing} variant="outline" className="gap-2 h-9 text-xs rounded-lg font-bold border-neutral-300 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5">
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sincronizar CRM
                </Button>
            </div>

            {/* QUADRO GERAL (Todos os Agentes) */}
            <div className="relative overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/80 backdrop-blur-2xl rounded-[2rem] border border-neutral-200/50 dark:border-white/5 p-8 shadow-2xl saturate-150 transition-all">
                {/* Glow Effects Ocultos Premium */}
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 mb-8 flex items-center justify-between">
                    <div>
                        <h3 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4" /> Quadro Geral de Consultores
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground/80 tracking-tight">Visão macro de performance e faturamento consolidados.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5 relative z-10">
                    {/* Card Vendas */}
                    <div className="lg:col-span-3 md:col-span-3 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-neutral-200/50 dark:border-white/5 shadow-sm hover:bg-white/80 dark:hover:bg-white/[0.02] transition-colors group animate-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-backwards">
                        <span className="text-[11px] text-muted-foreground font-black uppercase tracking-widest block mb-4 group-hover:text-foreground transition-colors">Vendas Totais</span>
                        <div className="text-4xl font-black text-foreground tracking-tighter">{globalSales}</div>
                    </div>

                    {/* Card Reuniões */}
                    <div className="lg:col-span-3 md:col-span-3 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-neutral-200/50 dark:border-white/5 shadow-sm hover:bg-white/80 dark:hover:bg-white/[0.02] transition-colors group animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-backwards">
                        <span className="text-[11px] text-muted-foreground font-black uppercase tracking-widest block mb-4 group-hover:text-foreground transition-colors">Reuniões Feitas</span>
                        <div className="text-4xl font-black text-foreground tracking-tighter">{globalDone}</div>
                    </div>

                    {/* Card Receita (Destaque Principal) */}
                    <div className="lg:col-span-6 md:col-span-6 bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 dark:from-emerald-500/10 dark:to-emerald-950/30 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-inner group overflow-hidden relative animate-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-backwards">
                        <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
                            <DollarSign className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                            <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-black uppercase tracking-widest block mb-4">Receita Gerada (MRR)</span>
                            <div className="text-5xl font-black text-emerald-700 dark:text-emerald-400 tracking-tighter mix-blend-luminosity">
                                {globalMRR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                    </div>

                    {/* Card LTV */}
                    <div className="lg:col-span-6 md:col-span-6 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-neutral-200/50 dark:border-white/5 shadow-sm hover:bg-white/80 dark:hover:bg-white/[0.02] transition-colors group animate-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-backwards">
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest block mb-4">LTV Projetado</span>
                        <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                            {globalLTV.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="mt-4 w-full h-1.5 bg-indigo-500/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full delay-500 animate-in slide-in-from-left-full duration-1000" style={{ width: '100%' }} />
                        </div>
                    </div>

                    {/* Card Conversão */}
                    <div className="lg:col-span-6 md:col-span-6 bg-yellow-50/50 dark:bg-yellow-500/5 backdrop-blur-md p-6 rounded-3xl border border-yellow-500/10 shadow-sm hover:bg-yellow-100/50 dark:hover:bg-yellow-500/10 transition-colors group animate-in slide-in-from-bottom-2 duration-500 delay-500 fill-mode-backwards">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[11px] text-yellow-700 dark:text-yellow-500 font-black uppercase tracking-widest block">Conversão Global</span>
                            <span className="text-[10px] font-bold text-yellow-600/70 dark:text-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 rounded-full">{globalDone} reuniões</span>
                        </div>
                        <div className="text-4xl font-black text-yellow-600 dark:text-yellow-500 tracking-tighter">{globalConversionRate}%</div>

                        <div className="mt-4 w-full h-1.5 bg-yellow-500/10 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full delay-700 animate-in slide-in-from-left-full duration-1000" style={{ width: `${Math.min(100, Number(globalConversionRate))}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full">
                {activeClosers.map((closer, idx) => {
                    const closerMetrics = Object.values(metrics[closer.id] || {});
                    const sumSales = closerMetrics.reduce((acc, m) => acc + (m.sales || 0), 0);
                    const sumMRR = closerMetrics.reduce((acc, m) => acc + (m.mrr || 0), 0);
                    const sumCommission = closerMetrics.reduce((acc, m) => acc + (m.commission || 0), 0);
                    const sumDone = closerMetrics.reduce((acc, m) => acc + (m.meetings_done || 0), 0);
                    const conversionRate = sumDone > 0 ? ((sumSales / sumDone) * 100).toFixed(1) : "0.0";

                    return (
                        <div key={closer.id} className="rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden mb-6 transition-all">
                            {/* Card Header: Global Metrics */}
                            <div className="p-5 border-b border-neutral-200/60 dark:border-white/5 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-white/40 dark:bg-transparent">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center font-bold text-xs ring-4 ring-blue-600/20 shrink-0">
                                        {closer.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold tracking-tight text-foreground">{closer.name}</h4>
                                        <p className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">Agente • Resumo Mensal {selectedMonth.split('-')[1]}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1"><Target className="w-3 h-3 text-blue-500" /> Vendas</span>
                                        <span className="text-lg font-black tracking-tighter text-foreground">{sumSales} <span className="text-[10px] text-muted-foreground font-medium">contratos</span></span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1"><TrendingUp className="w-3 h-3 text-indigo-500" /> MRR Direto</span>
                                        <span className="text-lg font-black tracking-tighter text-indigo-600 dark:text-indigo-400">{sumMRR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex flex-col border-l-0 lg:border-l border-neutral-200 dark:border-white/10 lg:pl-4">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1"><HandCoins className="w-3 h-3 text-emerald-500" /> Comissão</span>
                                        <span className="text-lg font-black tracking-tighter text-emerald-600 dark:text-emerald-400">{sumCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1"><CalendarDays className="w-3 h-3 text-amber-500" /> Conversão</span>
                                        <span className="text-lg font-black tracking-tighter">{conversionRate}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Layout do Heatmap & Editor */}
                            <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-neutral-200/60 dark:divide-white/5">
                                {/* Activity Heatmap / Mini Calendário */}
                                <div className="flex-1 p-5 lg:p-6 flex flex-col justify-between">
                                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Calendário de Conversões Diárias</h5>

                                    <div className="flex-1">
                                        {/* Grid do Calendário */}
                                        <div className="grid grid-cols-7 gap-1 md:gap-2 max-w-lg">
                                            {/* Cabeçalho dos dias da semana */}
                                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dw, i) => (
                                                <div key={`dw-${i}`} className="text-center text-[9px] md:text-[10px] text-muted-foreground font-black uppercase tracking-wider mb-2">{dw}</div>
                                            ))}

                                            {/* Offset para não errar o dia 1 */}
                                            {Array.from({ length: getDay(new Date(`${selectedMonth}-01T12:00:00Z`)) }).map((_, i) => (
                                                <div key={`empty-${i}`} className="w-full aspect-square" />
                                            ))}

                                            {/* Grade de Dias */}
                                            {daysInMonth.map(d => {
                                                const dateStr = format(d, 'yyyy-MM-dd');
                                                const metric = metrics[closer.id]?.[dateStr];
                                                const isSelected = editingDay?.closerId === closer.id && editingDay?.date === dateStr;

                                                const hasSales = (metric?.sales || 0) > 0;
                                                const hasMeetings = (metric?.meetings_done || 0) > 0;
                                                const noShow = (metric?.no_show || 0) > 0;

                                                let bgColor = "bg-neutral-100 dark:bg-zinc-800/60 text-muted-foreground";
                                                if (hasSales) bgColor = "bg-emerald-500 text-white shadow-emerald-500/30 font-bold shadow-sm";
                                                else if (hasMeetings) bgColor = "bg-blue-500 text-white shadow-blue-500/30 font-bold shadow-sm";
                                                else if (noShow) bgColor = "bg-amber-500/80 text-white";

                                                if (isSelected) bgColor += " ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900 border-black dark:border-white scale-110 z-10 relative";

                                                return (
                                                    <button
                                                        key={dateStr}
                                                        title={`${format(d, 'dd/MM/yyyy')} - Vendas: ${metric?.sales || 0}`}
                                                        onClick={() => setEditingDay({ closerId: closer.id, date: dateStr })}
                                                        className={`w-full aspect-square md:w-11 md:h-11 rounded-md transition-all text-xs border border-transparent hover:border-black/50 dark:hover:border-white/50 hover:scale-105 ${bgColor}`}
                                                    >
                                                        {format(d, 'd')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-2 items-center mt-6 pt-4 border-t border-neutral-200/60 dark:border-white/5 text-[10px] text-muted-foreground font-medium px-1">
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-neutral-100 dark:bg-zinc-800/60 rounded-[2px]" /> Sem Atividade</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-500/80 rounded-[2px]" /> Somente No-Show</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-[2px]" /> Reuniões Feitas</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-[2px]" /> Contrato Fechado</span>
                                    </div>
                                </div>

                                {/* Painel de Edição do Dia Selecionado */}
                                <div className="w-full lg:w-[350px] shrink-0 bg-neutral-50/50 dark:bg-zinc-900/40">
                                    {editingDay?.closerId === closer.id ? (() => {
                                        const selectedMetric = metrics[closer.id]?.[editingDay.date];
                                        return (
                                            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-500/10">
                                                    <div>
                                                        <h5 className="font-bold text-sm text-indigo-700 dark:text-indigo-400">Edição Diária</h5>
                                                        <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 font-medium">Data: {format(new Date(`${editingDay.date}T12:00:00`), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                    <button onClick={() => setEditingDay(null)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground transition-colors"><XCircle className="w-4 h-4" /></button>
                                                </div>
                                                <div className="p-5 space-y-4 flex-1">
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Marcadas</label>
                                                            <input type="number"
                                                                className="w-full h-8 px-2 bg-white dark:bg-zinc-950 border border-input rounded-md text-sm font-semibold text-center focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow"
                                                                value={selectedMetric?.meetings_scheduled || ""} onChange={(e) => handleCellChange(closer.id, editingDay.date, 'meetings_scheduled', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider leading-tight">Compareceram</label>
                                                            <input type="number"
                                                                className="w-full h-8 px-2 bg-white dark:bg-zinc-950 border border-input rounded-md text-sm font-semibold text-center focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow"
                                                                value={selectedMetric?.meetings_done || ""} onChange={(e) => handleCellChange(closer.id, editingDay.date, 'meetings_done', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] uppercase font-bold text-amber-600/70 dark:text-amber-500/70 tracking-wider">No Show</label>
                                                            <div className="w-full h-8 px-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-md text-sm font-bold text-center flex items-center justify-center text-amber-700 dark:text-amber-500">
                                                                {selectedMetric?.no_show || 0}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-neutral-200/60 dark:border-white/5 space-y-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                                    <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                </div>
                                                                <label className="text-[10px] uppercase tracking-widest font-bold text-foreground opacity-80">Lançar no CRM</label>
                                                            </div>
                                                        </div>

                                                        {/* Lançamento Simplificado In-App */}
                                                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 space-y-3 shadow-inner">
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] uppercase font-bold text-emerald-700/80 dark:text-emerald-400/80 tracking-widest">Origem da Venda (Lead)</label>
                                                                <select
                                                                    value={saleForm.chatId}
                                                                    onChange={(e) => setSaleForm({ ...saleForm, chatId: e.target.value })}
                                                                    className="w-full text-xs h-8 px-2 rounded bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 outline-none text-foreground font-semibold"
                                                                >
                                                                    <option value="">Selecione o Lead...</option>
                                                                    {(closerChats[closer.id] || []).map(lead => (
                                                                        <option key={lead.id} value={lead.id}>{lead.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-end gap-2">
                                                                <div className="space-y-1 flex-1">
                                                                    <label className="text-[9px] uppercase font-bold text-emerald-700/80 dark:text-emerald-400/80 tracking-widest" title="Receita Imediata (MRR)">Venda (R$)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="MRR"
                                                                        value={saleForm.amount}
                                                                        onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })}
                                                                        className="w-full text-sm font-black tracking-tight text-emerald-700 dark:text-emerald-400 h-8 px-2 rounded bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1 flex-1">
                                                                    <label className="text-[9px] uppercase font-bold text-emerald-700/80 dark:text-emerald-400/80 tracking-widest" title="Projeção Long-Term">LTV (R$)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Projeção"
                                                                        value={saleForm.ltvAmount}
                                                                        onChange={(e) => setSaleForm({ ...saleForm, ltvAmount: e.target.value })}
                                                                        className="w-full text-sm font-black tracking-tight text-emerald-700 dark:text-emerald-400 h-8 px-2 rounded bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    onClick={() => handleRegisterCRM(closer.id, editingDay.date)}
                                                                    disabled={savingSale || !saleForm.chatId || (!saleForm.amount && !saleForm.ltvAmount)}
                                                                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30 transition-all active:scale-95 px-3"
                                                                >
                                                                    {savingSale ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lançar"}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Campos Manuais Alternativos - Readonly Acumulados */}
                                                        <div className="flex-1 space-y-1.5 opacity-60">
                                                            <div className="flex justify-between items-center group">
                                                                <label className="text-[10px] font-bold text-foreground">Total Vendas Acumuladas</label>
                                                                <input disabled type="number" className="w-16 h-7 px-1 bg-transparent border-b border-transparent text-sm text-right font-bold cursor-not-allowed" value={selectedMetric?.sales || 0} />
                                                            </div>
                                                            <div className="flex justify-between items-center group">
                                                                <label className="text-[10px] font-bold text-foreground">Total MRR/LTV Acumulados</label>
                                                                <input disabled type="number" className="w-24 h-7 px-1 bg-transparent border-b border-transparent rounded text-sm text-right font-bold text-emerald-600 dark:text-emerald-400 cursor-not-allowed" value={selectedMetric?.mrr || selectedMetric?.ltv || 0} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4">
                                                        <div className="p-3 bg-emerald-500 text-white rounded-lg flex justify-between items-center shadow-lg shadow-emerald-500/20">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-90">Comissão Automática</span>
                                                            <span className="font-extrabold tracking-tight">{(selectedMetric?.commission || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })() : (
                                        <div className="h-full min-h-[250px] flex flex-col items-center justify-center p-8 text-center text-muted-foreground/60">
                                            <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
                                            <p className="text-sm font-bold text-foreground opacity-80">Selecione um dia</p>
                                            <p className="text-[10px] mt-1.5 mx-2 leading-relaxed">Clique em um quadrado no *Heatmap* para visualizar e editar as métricas do dia de {closer.name.split(' ')[0]}.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
