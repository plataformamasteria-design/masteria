import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Trash2, Users, Globe, Lock } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Stage {
  id: string;
  name: string;
  color: string;
  order_position: number;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

interface FunnelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId?: string | null;
  funnelName?: string;
  funnelIsPublic?: boolean;
  onSaved: () => void;
}

export function FunnelConfigDialog({
  open,
  onOpenChange,
  funnelId,
  funnelName: initialName = "",
  funnelIsPublic: initialIsPublic = true,
  onSaved,
}: FunnelConfigDialogProps) {
  const [name, setName] = useState(initialName);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  // Members management
  const [orgProfiles, setOrgProfiles] = useState<Profile[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const isEditing = !!funnelId;

  useEffect(() => {
    if (open) {
      setName(initialName);
      setIsPublic(initialIsPublic ?? true);
      if (isEditing) {
        fetchStages();
        fetchMembers();
      } else {
        setStages([]);
        setMemberIds(new Set());
      }
      fetchOrgProfiles();
    }
  }, [open, initialName, funnelId, initialIsPublic]);

  const fetchStages = async () => {
    if (!funnelId) return;
    const { data } = await (supabase as any)
      .from("funnel_stages")
      .select("*")
      .eq("funnel_id", funnelId)
      .order("order_position", { ascending: true });
    setStages(data || []);
  };

  const fetchMembers = async () => {
    if (!funnelId) return;
    const { data } = await (supabase as any)
      .from("funnel_members")
      .select("user_id")
      .eq("funnel_id", funnelId);
    setMemberIds(new Set((data || []).map((m: any) => m.user_id)));
  };

  const fetchOrgProfiles = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("organization_id", currentOrganization.id)
      .eq("approved", true)
      .order("full_name");
    setOrgProfiles(data || []);
  };

  const toggleMember = (userId: string) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addStage = () => {
    if (!newStageName.trim()) return;
    setStages((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: newStageName,
        color: newStageColor,
        order_position: prev.length,
      },
    ]);
    setNewStageName("");
    setNewStageColor("#3B82F6");
  };

  const removeStage = (idx: number) => {
    setStages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (stages.length === 0) {
      toast({ title: "Adicione ao menos uma etapa", variant: "destructive" });
      return;
    }
    if (!currentOrganization?.id) return;

    setSaving(true);
    try {
      let targetFunnelId = funnelId;

      if (isEditing) {
        await (supabase as any)
          .from("funnels")
          .update({ name, is_public: isPublic })
          .eq("id", funnelId);

        const existingIds = stages.filter((s) => !s.id.startsWith("new-")).map((s) => s.id);
        if (existingIds.length > 0) {
          await (supabase as any)
            .from("funnel_stages")
            .delete()
            .eq("funnel_id", funnelId)
            .not("id", "in", `(${existingIds.join(",")})`);
        } else {
          await (supabase as any)
            .from("funnel_stages")
            .delete()
            .eq("funnel_id", funnelId);
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("funnels")
          .insert({
            name,
            is_public: isPublic,
            visualization_type: "kanban",
            tag_order: [],
            organization_id: currentOrganization.id,
          })
          .select()
          .single();

        if (error) throw error;
        targetFunnelId = data.id;
      }

      // Upsert stages
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (stage.id.startsWith("new-")) {
          await (supabase as any).from("funnel_stages").insert({
            funnel_id: targetFunnelId,
            name: stage.name,
            color: stage.color,
            order_position: i,
            organization_id: currentOrganization.id,
          });
        } else {
          await (supabase as any)
            .from("funnel_stages")
            .update({ name: stage.name, color: stage.color, order_position: i })
            .eq("id", stage.id);
        }
      }

      // Save members (only if not public)
      if (targetFunnelId) {
        // Delete all existing members for this funnel
        await (supabase as any)
          .from("funnel_members")
          .delete()
          .eq("funnel_id", targetFunnelId);

        // Insert new members
        if (!isPublic && memberIds.size > 0) {
          const inserts = Array.from(memberIds).map((userId) => ({
            funnel_id: targetFunnelId,
            user_id: userId,
            organization_id: currentOrganization.id,
          }));
          await (supabase as any).from("funnel_members").insert(inserts);
        }
      }

      toast({ title: isEditing ? "Funil atualizado" : "Funil criado" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar funil", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!funnelId) return;
    if (!confirm("Excluir este funil e todas as suas etapas permanentemente?")) return;

    const { error } = await (supabase as any).from("funnels").delete().eq("id", funnelId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Funil excluído" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{isEditing ? "Editar Funil" : "Novo Funil"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-5 px-6 py-2">
            {/* Funnel Name */}
            <div className="space-y-2">
              <Label>Nome do Funil</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Funil de Vendas"
              />
            </div>

            {/* Access Control */}
            <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <Label className="text-sm font-medium">
                      {isPublic ? "Funil Público" : "Funil Privado"}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isPublic
                        ? "Todos os membros da organização podem ver"
                        : "Apenas membros selecionados podem ver"}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              {/* Member selection - always visible */}
              <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs">Membros com Acesso</Label>
                  {memberIds.size > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {memberIds.size}
                    </Badge>
                  )}
                </div>
                {isPublic && (
                  <p className="text-[10px] text-muted-foreground">
                    Funil público — todos podem ver, mas você pode restringir editando para privado.
                  </p>
                )}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {orgProfiles.map((profile) => {
                    const isMember = memberIds.has(profile.id);
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => toggleMember(profile.id)}
                        disabled={isPublic}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all ${
                          isPublic ? "opacity-50 cursor-not-allowed" :
                          isMember
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {(profile.full_name || profile.email)[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {profile.full_name || profile.email}
                          </p>
                          {profile.full_name && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {profile.email}
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                            isMember
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isMember && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Stages List */}
            <div className="space-y-2">
              <Label>Etapas do Funil (em ordem)</Label>
              <div className="space-y-1.5">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/30"
                  >
                    <span className="text-xs text-muted-foreground font-mono w-5">{idx + 1}</span>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-medium flex-1">{stage.name}</span>
                    <button onClick={() => removeStage(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {stages.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    Adicione etapas ao funil abaixo
                  </p>
                )}
              </div>
            </div>

            {/* Add Stage */}
            <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
              <Label className="text-xs">Adicionar Etapa</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-8 h-8 rounded-md border border-border shrink-0"
                      style={{ backgroundColor: newStageColor }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <HexColorPicker color={newStageColor} onChange={setNewStageColor} />
                  </PopoverContent>
                </Popover>
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Nome da etapa"
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addStage()}
                />
                <Button size="sm" onClick={addStage} disabled={!newStageName.trim()} className="shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-3 gap-2 shrink-0 border-t border-border/50">
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Criar Funil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
