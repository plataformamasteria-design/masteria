import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdTrafficWidget({ dateRange }: { dateRange?: { from?: Date, to?: Date } }) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);
    const [loading, setLoading] = useState(true);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6'];

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                let query = (supabase as any)
                    .from("chats")
                    .select("campaign_name")
                    .eq("organization_id", orgId)
                    .not("campaign_name", "is", null);

                if (dateRange?.from) {
                    query = query.gte("created_at", dateRange.from.toISOString());
                }
                if (dateRange?.to) {
                    // Set to end of day
                    const end = new Date(dateRange.to);
                    end.setHours(23, 59, 59, 999);
                    query = query.lte("created_at", end.toISOString());
                }

                const { data: rows } = await query;

                const counts: Record<string, number> = {};
                (rows || []).forEach((row: any) => {
                    const name = row.campaign_name || 'Desconhecida';
                    counts[name] = (counts[name] || 0) + 1;
                });

                const chartData = Object.entries(counts)
                    .map(([name, value], i) => ({
                        name: name.length > 25 ? name.substring(0, 25) + "..." : name,
                        value,
                        color: COLORS[i % COLORS.length]
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 6); // Top 6

                setData(chartData);
            } catch (e) {
                console.error("[AdTrafficWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId, dateRange]);

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader className="pb-2"><Skeleton className="h-5 w-44" /></CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <Skeleton className="h-40 w-40 rounded-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full glass border-white/10 hover:border-white/20 transition-all duration-300">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Origem dos Leads (Anúncios)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                        Nenhum lead com origem rastreada.
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [`${value} leads`, 'Total']}
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.8)'
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
