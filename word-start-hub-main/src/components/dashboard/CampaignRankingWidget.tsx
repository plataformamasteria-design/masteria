import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignRow {
    campaign_name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    roas: number;
}

export default function CampaignRankingWidget() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orgId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data } = await (supabase as any)
                    .from("marketing_campaigns")
                    .select("campaign_name, spend, impressions, clicks, ctr, roas")
                    .eq("organization_id", orgId)
                    .order("spend", { ascending: false })
                    .limit(5);

                setCampaigns(data || []);
            } catch (e) {
                console.error("[CampaignRankingWidget] Error:", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orgId]);

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-44" /></CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
            </Card>
        );
    }

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-blue-500" />
                    Top Campanhas
                </CardTitle>
            </CardHeader>
            <CardContent>
                {campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma campanha sincronizada</p>
                ) : (
                    <div className="space-y-2.5">
                        {campaigns.map((c, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}º</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{c.campaign_name || "Sem nome"}</p>
                                    <div className="flex gap-3 mt-0.5">
                                        <span className="text-[10px] text-muted-foreground">Gasto: {fmt(c.spend || 0)}</span>
                                        <span className="text-[10px] text-muted-foreground">CTR: {(c.ctr || 0).toFixed(2)}%</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold ${(c.roas || 0) >= 1 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {(c.roas || 0).toFixed(1)}x
                                    </span>
                                    <p className="text-[10px] text-muted-foreground">ROAS</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
