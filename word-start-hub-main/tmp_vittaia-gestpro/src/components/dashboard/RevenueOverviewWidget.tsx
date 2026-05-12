import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueData {
    receita: number;
    investimento: number;
    roi: number;
    cac: number;
    leads: number;
    conversoes: number;
}

interface Props {
    startDate?: Date;
    endDate?: Date;
}

export default function RevenueOverviewWidget({ startDate, endDate }: Props) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [data, setData] = useState<RevenueData | null>(null);
    const [prevData, setPrevData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                const start = startDate?.toISOString() || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                const end = endDate?.toISOString() || new Date().toISOString();

                // Receita: transações do tipo income no período
                const { data: txns } = await (supabase as any)
                    .from("transactions")
                    .select("amount, type")
                    .eq("organization_id", orgId)
                    .gte("transaction_date", start.split("T")[0])
                    .lte("transaction_date", end.split("T")[0]);

                const receita = (txns || [])
                    .filter((t: any) => t.type === "income")
                    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                // Investimento: soma das despesas operacionais da tabela transactions
                const investimento = (txns || [])
                    .filter((t: any) => t.type === "expense")
                    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                // Leads: chats criados no período (não grupo)
                const { count: leads } = await (supabase as any)
                    .from("chats")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("is_group", false)
                    .gte("created_at", start)
                    .lte("created_at", end);

                // Conversões: chats resolvidos como 'sold'
                const { count: conversoes } = await (supabase as any)
                    .from("chats")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("resolution_outcome", "client")
                    .gte("resolved_at", start)
                    .lte("resolved_at", end);

                const roi = investimento > 0 ? ((receita - investimento) / investimento) * 100 : 0;
                const cac = (conversoes || 0) > 0 ? investimento / (conversoes || 1) : 0;

                setData({
                    receita,
                    investimento,
                    roi,
                    cac,
                    leads: leads || 0,
                    conversoes: conversoes || 0,
                });
            } catch (e) {
                console.error("[RevenueOverviewWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId, startDate, endDate]);

    const fmt = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const cards = useMemo(() => {
        if (!data) return [];
        return [
            {
                title: "Receita Total",
                value: fmt(data.receita),
                icon: DollarSign,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
            },
            {
                title: "Despesas Totais",
                value: fmt(data.investimento),
                icon: Target,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
            },
            {
                title: "ROI",
                value: `${data.roi.toFixed(1)}%`,
                icon: data.roi >= 0 ? TrendingUp : TrendingDown,
                color: data.roi >= 0 ? "text-emerald-500" : "text-rose-500",
                bg: data.roi >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
            },
            {
                title: "CAC",
                value: fmt(data.cac),
                icon: ArrowDownRight,
                color: "text-amber-500",
                bg: "bg-amber-500/10",
            },
        ];
    }, [data]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-7 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
                <Card key={card.title} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
                            <div className={`p-1.5 rounded-lg ${card.bg}`}>
                                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                            </div>
                        </div>
                        <p className="text-xl font-bold tracking-tight">{card.value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
