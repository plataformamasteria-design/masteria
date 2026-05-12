import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieChartIcon, UserX, Star, DollarSign, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, LOSS_LABELS } from "../utils";
import type { DiagnosticData, EnrichedMonthData } from "../types";

interface CommissionConfig {
    commission_type: string;
    fixed_value: number;
    percentage_value: number;
}

interface EnrichedDataCardsProps {
    d: any; // Using any to quickly bridge, but should be DiagnosticData
    selectedEnriched: EnrichedMonthData;
    orgUsers: any[];
    commissions: Record<string, CommissionConfig>;
    setCommissions: React.Dispatch<React.SetStateAction<Record<string, CommissionConfig>>>;
    saveCommission: (userId: string, type: string, fixed: number, percentage: number) => void;
    savingCommission: boolean;
    fmt: (v: number) => string;
}

export function EnrichedDataCards({
    d,
    selectedEnriched,
    orgUsers,
    commissions,
    setCommissions,
    saveCommission,
    savingCommission,
    fmt
}: EnrichedDataCardsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pipeline Status */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4 text-blue-500" />
                        Distribuição de Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const statusData = [
                            { name: "Novos", value: Math.max(d.total_leads - selectedEnriched.leads_qualificados, 0) },
                            { name: "Qualificados", value: Math.max(selectedEnriched.leads_qualificados - selectedEnriched.leads_convertidos - selectedEnriched.leads_perdidos - selectedEnriched.leads_adiados, 0) },
                            { name: "Clientes", value: selectedEnriched.leads_convertidos },
                            { name: "Perdidos", value: selectedEnriched.leads_perdidos },
                            { name: "Adiados", value: selectedEnriched.leads_adiados },
                        ].filter(s => s.value > 0);
                        const total = statusData.reduce((s, d) => s + d.value, 0);
                        if (total === 0) return <p className="text-xs text-muted-foreground text-center py-8">Sem dados neste mês</p>;
                        return (
                            <div>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                                            {statusData.map((_, idx) => <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap gap-2 justify-center mt-1">
                                    {statusData.map((s, idx) => (
                                        <div key={s.name} className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[idx % STATUS_COLORS.length] }} />
                                            <span className="text-[10px] text-muted-foreground">{s.name}: {s.value}</span>
                                        </div>
                                    ))}
                                </div>
                                {selectedEnriched.avg_resolution_hours > 0 && (
                                    <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted/50">
                                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-[11px] text-muted-foreground">
                                            Tempo médio: <span className="font-bold text-foreground">{selectedEnriched.avg_resolution_hours.toFixed(1)}h</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>

            {/* Loss Reasons */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <UserX className="h-4 w-4 text-rose-500" />
                        Motivos de Perda
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const lossEntries = Object.entries(selectedEnriched.loss_reasons)
                            .map(([key, count]) => ({ reason: LOSS_LABELS[key] || key, count }))
                            .sort((a, b) => b.count - a.count);
                        if (lossEntries.length === 0) return <p className="text-xs text-muted-foreground text-center py-8">Sem perdas registradas</p>;
                        const maxCount = Math.max(...lossEntries.map(e => e.count));
                        return (
                            <div className="space-y-2.5">
                                {lossEntries.map(entry => (
                                    <div key={entry.reason}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[11px] font-medium">{entry.reason}</span>
                                            <span className="text-[11px] font-bold text-rose-500">{entry.count}</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${(entry.count / maxCount) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-border/50 mt-3">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-muted-foreground">Total de perdas</span>
                                        <span className="font-bold">{lossEntries.reduce((s, e) => s + e.count, 0)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>

            {/* Agent Performance */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        Performance por Agente
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedEnriched.closers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Sem atendimentos resolvidos</p>
                    ) : (
                        <div className="space-y-2">
                            {selectedEnriched.closers.slice(0, 5).map((closer, idx) => (
                                <div key={closer.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">
                                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`}
                                    </span>
                                    <Avatar className="h-6 w-6 shrink-0">
                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                            {closer.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium truncate">{closer.name}</p>
                                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                                            <span>{closer.total} atend.</span>
                                            <span className="text-emerald-500">{closer.convertidos} ✓</span>
                                            <span className="text-rose-500">{closer.perdidos} ✗</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={cn("text-xs font-bold", closer.taxa >= 30 ? "text-emerald-500" : closer.taxa >= 15 ? "text-amber-500" : "text-rose-500")}>
                                            {closer.taxa.toFixed(0)}%
                                        </span>
                                        {closer.avg_hours > 0 && (
                                            <p className="text-[9px] text-muted-foreground flex items-center gap-0.5 justify-end">
                                                <Clock className="h-2.5 w-2.5" />{closer.avg_hours.toFixed(1)}h
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Commission Config */}
            <Card className="col-span-full">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Comissões por Agente
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {orgUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Nenhum agente cadastrado</p>
                    ) : (
                        <div className="space-y-3">
                            {orgUsers.map(user => {
                                const comm = commissions[user.id] || { commission_type: 'percentage', fixed_value: 0, percentage_value: 0 };
                                const ticketMedio = d.contracts_won > 0 ? d.mrr / d.contracts_won : 0;
                                const earned = (() => {
                                    const agentData = selectedEnriched?.closers?.find(c => c.id === user.id);
                                    const agentFechamentos = agentData?.convertidos || 0;
                                    let total = 0;
                                    if (comm.commission_type === 'fixed' || comm.commission_type === 'both') total += comm.fixed_value * agentFechamentos;
                                    if (comm.commission_type === 'percentage' || comm.commission_type === 'both') total += (comm.percentage_value / 100) * ticketMedio * agentFechamentos;
                                    return total;
                                })();
                                return (
                                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                                            {earned > 0 && <p className="text-[10px] text-emerald-600 font-semibold">Comissão: {fmt(earned)}</p>}
                                        </div>
                                        <select value={comm.commission_type} onChange={e => { const newType = e.target.value; setCommissions(prev => ({ ...prev, [user.id]: { ...comm, commission_type: newType } })); }} className="h-7 text-[11px] rounded-md border border-input bg-background px-1.5 w-24">
                                            <option value="fixed">Fixo</option>
                                            <option value="percentage">%</option>
                                            <option value="both">Fixo + %</option>
                                        </select>
                                        {(comm.commission_type === 'fixed' || comm.commission_type === 'both') && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-muted-foreground">R$</span>
                                                <input type="number" value={comm.fixed_value} onChange={e => setCommissions(prev => ({ ...prev, [user.id]: { ...comm, fixed_value: Number(e.target.value) } }))} className="h-7 w-20 text-[11px] rounded-md border border-input bg-background px-1.5" />
                                            </div>
                                        )}
                                        {(comm.commission_type === 'percentage' || comm.commission_type === 'both') && (
                                            <div className="flex items-center gap-1">
                                                <input type="number" value={comm.percentage_value} onChange={e => setCommissions(prev => ({ ...prev, [user.id]: { ...comm, percentage_value: Number(e.target.value) } }))} className="h-7 w-16 text-[11px] rounded-md border border-input bg-background px-1.5" />
                                                <span className="text-[10px] text-muted-foreground">%</span>
                                            </div>
                                        )}
                                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => saveCommission(user.id, comm.commission_type, comm.fixed_value, comm.percentage_value)} disabled={savingCommission}>
                                            Salvar
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
