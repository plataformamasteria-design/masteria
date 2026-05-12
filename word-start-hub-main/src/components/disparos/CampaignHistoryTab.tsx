import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Play, XCircle, RotateCcw, FileText, ListPlus, Ban, Trash2, Download, Globe, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", icon: Clock, variant: "outline" },
  pending: { label: "Pendente", icon: Clock, variant: "outline" },
  scheduled: { label: "Agendado", icon: Clock, variant: "secondary" },
  running: { label: "Enviando", icon: Play, variant: "default" },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "secondary" },
  failed: { label: "Falhou", icon: XCircle, variant: "destructive" },
  cancelled: { label: "Cancelado", icon: Ban, variant: "outline" },
};

interface UnifiedCampaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
  target_phones: string[] | null;
  message_content: string | null;
  scheduled_at: string | null;
  channel: "evolution" | "meta";
}

interface CampaignHistoryTabProps {
  onRepeatCampaign?: (campaign: any) => void;
}

// Parse message_content which may be JSON array of steps or plain text
function parseMessageSummary(content: string | null): string {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((step: any) => {
        const type = step.message_type || 'text';
        if (type === 'text') return step.content || '';
        if (type === 'audio') return '🎵 Áudio';
        if (type === 'image') return `🖼️ Imagem${step.content ? `: ${step.content}` : ''}`;
        if (type === 'video') return '🎬 Vídeo';
        if (type === 'pdf') return `📄 ${step.file_name || 'PDF'}`;
        return step.content || '';
      }).filter(Boolean).join(' → ');
    }
  } catch { }
  return content;
}

function exportCampaignCSV(campaign: UnifiedCampaign) {
  const rows = [
    ["Campo", "Valor"],
    ["Nome", campaign.name],
    ["Canal", campaign.channel === "meta" ? "WhatsApp Oficial (Meta)" : "Vitta IA (Evolution)"],
    ["Status", campaign.status],
    ["Total Destinatários", String(campaign.total_recipients)],
    ["Enviados", String(campaign.sent_count)],
    ["Falhas", String(campaign.failed_count)],
    ["Data", campaign.created_at],
  ];
  if (campaign.target_phones?.length) {
    rows.push([""], ["Números Enviados", ""]);
    campaign.target_phones.forEach(p => rows.push(["", p]));
  }
  const csvContent = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campanha-${campaign.name.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CampaignHistoryTab({ onRepeatCampaign }: CampaignHistoryTabProps) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; channel: "evolution" | "meta" } | null>(null);

  // Fetch Evolution campaigns
  const { data: evoCampaigns = [], isLoading: loadingEvo } = useQuery({
    queryKey: ["broadcast-campaigns", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []).map((c: any) => ({ ...c, channel: "evolution" as const }));
    },
    enabled: !!orgId,
    refetchInterval: 10000,
  });

  // Fetch Meta campaigns
  const { data: metaCampaigns = [], isLoading: loadingMeta } = useQuery({
    queryKey: ["meta-campaigns-history", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("wa_official_campaigns")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        created_at: c.created_at,
        sent_count: c.sent_count || 0,
        failed_count: c.failed_count || 0,
        total_recipients: c.total_recipients || 0,
        target_phones: c.target_phones,
        message_content: null,
        scheduled_at: null,
        channel: "meta" as const,
      }));
    },
    enabled: !!orgId,
    refetchInterval: 10000,
  });

  // Merge and sort by date
  const allCampaigns: UnifiedCampaign[] = [...evoCampaigns, ...metaCampaigns]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = loadingEvo || loadingMeta;

  const handleSaveAsTemplate = async (campaign: UnifiedCampaign) => {
    if (!orgId || !campaign.message_content) return;
    await supabase.from("broadcast_message_templates").insert({
      organization_id: orgId,
      name: `Modelo - ${campaign.name}`,
      content: campaign.message_content,
    });
    queryClient.invalidateQueries({ queryKey: ["broadcast-templates"] });
    toast({ title: "Mensagem salva como modelo!" });
  };

  const handleSaveList = async (campaign: UnifiedCampaign) => {
    if (!orgId || !campaign.target_phones?.length) {
      toast({ variant: "destructive", title: "Esta campanha não possui lista de números" });
      return;
    }
    const { error } = await supabase.from("broadcast_lists").insert({
      organization_id: orgId,
      name: `Lista - ${campaign.name}`,
      phones: campaign.target_phones,
      phone_count: campaign.target_phones.length,
    });
    if (error) {
      toast({ variant: "destructive", title: "Erro ao salvar lista", description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
    toast({ title: "Lista salva com sucesso!" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.channel === "meta" ? "wa_official_campaigns" : "broadcast_campaigns";
    await supabase.from(table).delete().eq("id", deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["meta-campaigns-history"] });
    setDeleteTarget(null);
    toast({ title: "Campanha excluída" });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (allCampaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum disparo realizado ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {allCampaigns.map((c) => {
          const config = statusConfig[c.status] || statusConfig.draft;
          const Icon = config.icon;
          const percent = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
          const summary = c.channel === "meta" ? "📨 Template Meta Oficial" : parseMessageSummary(c.message_content);

          return (
            <Card key={`${c.channel}-${c.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-sm truncate">{c.name}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 gap-1 ${c.channel === "meta" ? "border-blue-400/50 text-blue-600 bg-blue-50" : "border-emerald-400/50 text-emerald-600 bg-emerald-50"}`}>
                        {c.channel === "meta" ? <Globe className="h-2.5 w-2.5" /> : <Smartphone className="h-2.5 w-2.5" />}
                        {c.channel === "meta" ? "Meta" : "Evolution"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={config.variant} className="gap-1">
                      <Icon className="h-3 w-3" /> {config.label}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget({ id: c.id, channel: c.channel })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {summary && (
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded mb-2 line-clamp-2 whitespace-pre-wrap">
                    {summary}
                  </p>
                )}

                <div className="space-y-2">
                  <Progress value={percent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.sent_count}/{c.total_recipients} enviados</span>
                    {c.failed_count > 0 && <span className="text-destructive">{c.failed_count} falhas</span>}
                    <span>{percent}%</span>
                  </div>
                </div>

                {c.scheduled_at && c.status === "scheduled" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Agendado para {format(new Date(c.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}

                <div className="flex gap-2 mt-3 flex-wrap">
                  {onRepeatCampaign && c.channel === "evolution" && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => onRepeatCampaign(c)}>
                      <RotateCcw className="h-3 w-3" /> Repetir
                    </Button>
                  )}
                  {c.message_content && c.channel === "evolution" && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleSaveAsTemplate(c)}>
                      <FileText className="h-3 w-3" /> Salvar Modelo
                    </Button>
                  )}
                  {c.target_phones && c.target_phones.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleSaveList(c)}>
                      <ListPlus className="h-3 w-3" /> Salvar Lista
                    </Button>
                  )}
                  {(c.status === "completed" || c.status === "failed" || c.status === "cancelled") && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => exportCampaignCSV(c)}>
                      <Download className="h-3 w-3" /> Exportar CSV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O registro da campanha será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}