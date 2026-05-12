import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tags } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagStat {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function TagDistributionWidget() {
  const { currentOrganization } = useOrganization();
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const [tagsRes, chatTagsRes] = await Promise.all([
        (supabase as any).from("tags").select("id, name, color").eq("organization_id", currentOrganization.id),
        (supabase as any).from("chat_tags").select("tag_id").eq("organization_id", currentOrganization.id),
      ]);

      const counts: Record<string, number> = {};
      (chatTagsRes.data || []).forEach((ct: any) => {
        counts[ct.tag_id] = (counts[ct.tag_id] || 0) + 1;
      });

      const tagStats: TagStat[] = (tagsRes.data || [])
        .map((t: any) => ({ id: t.id, name: t.name, color: t.color || "#888", count: counts[t.id] || 0 }))
        .sort((a: TagStat, b: TagStat) => b.count - a.count)
        .slice(0, 10);

      setTags(tagStats);
    } catch (e) {
      console.error("Tag widget error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = Math.max(...tags.map(t => t.count), 1);

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
            <Tags className="h-5 w-5 text-pink-500" />
          </div>
          <CardTitle className="text-lg font-bold">Etiquetas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-6 bg-muted/20" />)}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma etiqueta</p>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="group flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-xs font-medium flex-1 truncate">{tag.name}</span>
                <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(tag.count / maxCount) * 100}%`,
                        backgroundColor: tag.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-6 text-right">{tag.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
