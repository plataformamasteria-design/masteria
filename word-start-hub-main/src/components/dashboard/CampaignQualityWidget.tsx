import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Target, Megaphone, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

interface CampaignQuality {
  campaign_name: string;
  quality_score: number;
  true_roas: number;
  cost_per_qualified_lead: number;
  conversion_rate: number;
  total_leads: number;
  qualified_leads: number;
  meetings_from_campaign: number;
  contracts_from_campaign: number;
  revenue_from_campaign: number;
  spend: number;
}

export default function CampaignQualityWidget() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [campaigns, setCampaigns] = useState<CampaignQuality[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("campaign_quality_scores")
          .select("campaign_name, quality_score, true_roas, cost_per_qualified_lead, conversion_rate, total_leads, qualified_leads, meetings_from_campaign, contracts_from_campaign, revenue_from_campaign, spend")
          .eq("organization_id", orgId)
          .order("quality_score", { ascending: false })
          .limit(5);
        setCampaigns(data || []);
      } catch (e) {
        console.error("[CampaignQualityWidget]", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-amber-500";
    return "text-rose-500";
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Regular";
    return "Ruim";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-orange-500" />
          Qualidade de Campanhas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma campanha analisada ainda
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium truncate flex-1 mr-2">{c.campaign_name || "Sem nome"}</p>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", scoreColor(c.quality_score))}>
                    {c.quality_score}/100 · {scoreLabel(c.quality_score)}
                  </Badge>
                </div>
                <Progress value={c.quality_score} className="h-1.5" />
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">True ROAS</p>
                    <p className={cn("text-xs font-bold", c.true_roas >= 1 ? "text-emerald-500" : "text-rose-500")}>
                      {c.true_roas.toFixed(1)}x
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">CPL Qualif.</p>
                    <p className="text-xs font-bold">{fmt(c.cost_per_qualified_lead)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Conversão</p>
                    <p className="text-xs font-bold">{c.conversion_rate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Receita</p>
                    <p className="text-xs font-bold text-emerald-500">{fmt(c.revenue_from_campaign)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
