import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, Clock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CloserRow {
    closer_id: string;
    closer_name: string;
    total: number;
    conversoes: number;
    taxa: number;
    receita: number;
}

interface Props {
    startDate?: Date;
    endDate?: Date;
}

export default function CloserRankingWidget({ startDate, endDate }: Props) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [closers, setClosers] = useState<CloserRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                const start = startDate?.toISOString() || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                const end = endDate?.toISOString() || new Date().toISOString();

                // Buscar chats resolvidos com atendente, agrupados por assigned_to
                const { data: chats } = await (supabase as any)
                    .from("chats")
                    .select("assigned_to, resolution_outcome, resolved_at")
                    .eq("organization_id", orgId)
                    .eq("is_group", false)
                    .not("assigned_to", "is", null)
                    .not("resolution_outcome", "is", null)
                    .gte("resolved_at", start)
                    .lte("resolved_at", end);

                if (!chats || chats.length === 0) {
                    setClosers([]);
                    setLoading(false);
                    return;
                }

                // Agrupar por closer
                const grouped = new Map<string, { total: number; sold: number }>();
                for (const c of chats) {
                    const key = c.assigned_to;
                    const current = grouped.get(key) || { total: 0, sold: 0 };
                    current.total++;
                    if (c.resolution_outcome === "client") current.sold++;
                    grouped.set(key, current);
                }

                // Buscar nomes dos profiles
                const closerIds = Array.from(grouped.keys());
                const { data: profiles } = await (supabase as any)
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", closerIds);

                const profileMap = new Map<string, string>((profiles || []).map((p: any) => [p.id, p.full_name || "Sem nome"]));

                // Buscar transações agrupadas
                const { data: txns } = await (supabase as any)
                    .from("transactions")
                    .select("chat_id, amount, type")
                    .eq("organization_id", orgId)
                    .eq("type", "income");

                // Mapear receita por chat → closer
                const { data: chatClosers } = await (supabase as any)
                    .from("chats")
                    .select("id, assigned_to")
                    .eq("organization_id", orgId)
                    .in("assigned_to", closerIds);

                const chatToCloser = new Map<string, string>((chatClosers || []).map((c: any) => [c.id, c.assigned_to]));
                const closerReceita = new Map<string, number>();
                for (const t of (txns || [])) {
                    const closerId = chatToCloser.get(String(t.chat_id));
                    if (closerId) {
                        closerReceita.set(closerId, (closerReceita.get(closerId) || 0) + (Number(t.amount) || 0));
                    }
                }

                const result: CloserRow[] = Array.from(grouped.entries())
                    .map(([id, data]) => ({
                        closer_id: id,
                        closer_name: profileMap.get(id) || "Sem nome",
                        total: data.total,
                        conversoes: data.sold,
                        taxa: data.total > 0 ? (data.sold / data.total) * 100 : 0,
                        receita: closerReceita.get(id) || 0,
                    }))
                    .sort((a, b) => b.conversoes - a.conversoes)
                    .slice(0, 5);

                setClosers(result);
            } catch (e) {
                console.error("[CloserRankingWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId, startDate, endDate]);

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const initials = (name: string) => name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-36" /></CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-500" />
                    Ranking de Closers
                </CardTitle>
            </CardHeader>
            <CardContent>
                {closers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhum atendimento resolvido no período</p>
                ) : (
                    <div className="space-y-2">
                        {closers.map((c, idx) => (
                            <div key={c.closer_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <span className="text-xs font-bold text-muted-foreground w-5">
                                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`}
                                </span>
                                <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                        {initials(c.closer_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{c.closer_name}</p>
                                    <div className="flex gap-3 mt-0.5">
                                        <span className="text-[10px] text-muted-foreground">{c.total} atend.</span>
                                        <span className="text-[10px] text-emerald-500 font-medium">{c.conversoes} vendas</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-emerald-500">{c.taxa.toFixed(0)}%</span>
                                    <p className="text-[10px] text-muted-foreground">{fmt(c.receita)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
