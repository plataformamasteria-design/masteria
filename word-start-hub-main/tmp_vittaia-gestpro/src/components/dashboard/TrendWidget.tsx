import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

interface MonthData {
    month: string;
    leads: number;
    conversoes: number;
    receita: number;
}

export default function TrendWidget() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [data, setData] = useState<MonthData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                // Gerar últimos 6 meses
                const months: MonthData[] = [];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const start = d.toISOString();
                    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
                    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();

                    // Leads
                    const { count: leads } = await (supabase as any)
                        .from("chats")
                        .select("id", { count: "exact", head: true })
                        .eq("organization_id", orgId)
                        .eq("is_group", false)
                        .gte("created_at", start)
                        .lte("created_at", end);

                    // Conversões
                    const { count: conversoes } = await (supabase as any)
                        .from("chats")
                        .select("id", { count: "exact", head: true })
                        .eq("organization_id", orgId)
                        .eq("resolution_outcome", "client")
                        .gte("resolved_at", start)
                        .lte("resolved_at", end);

                    // Receita
                    const { data: txns } = await (supabase as any)
                        .from("transactions")
                        .select("amount")
                        .eq("organization_id", orgId)
                        .eq("type", "income")
                        .gte("transaction_date", start.split("T")[0])
                        .lte("transaction_date", end.split("T")[0]);

                    const receita = (txns || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                    months.push({ month: label, leads: leads || 0, conversoes: conversoes || 0, receita });
                }

                setData(months);
            } catch (e) {
                console.error("[TrendWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId]);

    const fmtCurrency = (v: number) =>
        v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-44" /></CardHeader>
                <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Tendência (6 meses)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                        <Tooltip
                            contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "11px",
                            }}
                            formatter={(value: number, name: string) => {
                                if (name === "receita") return [fmtCurrency(value), "Receita"];
                                return [value, name === "leads" ? "Leads" : "Conversões"];
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="leads"
                            stroke="#3b82f6"
                            fill="url(#gradLeads)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            name="leads"
                        />
                        <Area
                            type="monotone"
                            dataKey="conversoes"
                            stroke="#10b981"
                            fill="url(#gradConv)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            name="conversoes"
                        />
                    </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-muted-foreground">Leads</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-muted-foreground">Conversões</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
