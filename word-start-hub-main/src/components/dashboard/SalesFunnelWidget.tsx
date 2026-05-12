import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileCheck, Trophy, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

interface FunnelStep {
    label: string;
    value: number;
    color: string;
    icon: any;
}

interface Props {
    startDate?: Date;
    endDate?: Date;
}

export default function SalesFunnelWidget({ startDate, endDate }: Props) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [steps, setSteps] = useState<FunnelStep[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                const start = startDate?.toISOString() || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                const end = endDate?.toISOString() || new Date().toISOString();

                // Total leads (chats não-grupo criados no período)
                const { count: totalLeads } = await (supabase as any)
                    .from("chats")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("is_group", false)
                    .gte("created_at", start)
                    .lte("created_at", end);

                // Reuniões agendadas (bookings no período)
                const { count: reunioes } = await (supabase as any)
                    .from("bookings")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .gte("start_time", start)
                    .lte("start_time", end);

                // Chats com tag de qualificação ou atribuídos (proxy para qualificados)
                const { count: qualificados } = await (supabase as any)
                    .from("chats")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("is_group", false)
                    .not("assigned_to", "is", null)
                    .gte("created_at", start)
                    .lte("created_at", end);

                // Contratos fechados
                const { count: contratos } = await (supabase as any)
                    .from("chats")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", orgId)
                    .eq("resolution_outcome", "client")
                    .gte("resolved_at", start)
                    .lte("resolved_at", end);

                setSteps([
                    { label: "Leads", value: totalLeads || 0, color: "bg-blue-500", icon: Users },
                    { label: "Qualificados", value: qualificados || 0, color: "bg-violet-500", icon: FileCheck },
                    { label: "Reuniões", value: reunioes || 0, color: "bg-amber-500", icon: Calendar },
                    { label: "Contratos", value: contratos || 0, color: "bg-emerald-500", icon: Trophy },
                ]);
            } catch (e) {
                console.error("[SalesFunnelWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId, startDate, endDate]);

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="flex gap-4 items-end h-32">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="flex-1 h-full rounded-lg" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    const maxValue = Math.max(...steps.map((s) => s.value), 1);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500" />
                    Funil de Vendas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-2 h-36">
                    {steps.map((step, idx) => {
                        const height = Math.max((step.value / maxValue) * 100, 15);
                        const convRate = idx > 0 && steps[idx - 1].value > 0
                            ? ((step.value / steps[idx - 1].value) * 100).toFixed(0)
                            : null;

                        return (
                            <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                                {/* Conversion rate arrow */}
                                {convRate && (
                                    <span className="text-[10px] font-medium text-muted-foreground mb-0.5">
                                        {convRate}%
                                    </span>
                                )}
                                {/* Value */}
                                <span className="text-sm font-bold">{step.value}</span>
                                {/* Bar */}
                                <div
                                    className={`w-full rounded-lg ${step.color} transition-all duration-500 ease-out`}
                                    style={{ height: `${height}%`, minHeight: 12 }}
                                />
                                {/* Label */}
                                <div className="flex items-center gap-1 mt-1">
                                    <step.icon className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] font-medium text-muted-foreground">{step.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
