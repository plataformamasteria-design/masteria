import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const tierMap: Record<string, { label: string; className: string }> = {
  hot: { label: "🔥 Hot", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  warm: { label: "🌡️ Warm", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  cold: { label: "❄️ Cold", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  dead: { label: "💀 Dead", className: "bg-muted text-muted-foreground border-border" },
};

export function LeadQualityBadge({ chatId }: { chatId: string | null }) {
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) return;
    (supabase as any)
      .from("lead_quality_scores")
      .select("quality_tier")
      .eq("chat_id", chatId)
      .maybeSingle()
      .then(({ data }: any) => { if (data) setTier(data.quality_tier); });
  }, [chatId]);

  if (!tier) return null;
  const info = tierMap[tier] || tierMap.cold;

  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}
