import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquareText } from "lucide-react";

interface MessageTagRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TagRule {
  id: string;
  tag_id: string;
  match_text: string;
  match_type: "exact" | "contains";
  active: boolean;
}

interface TagOption {
  id: string;
  name: string;
  color: string;
}

export function MessageTagRulesDialog({ open, onOpenChange }: MessageTagRulesDialogProps) {
  const { currentOrganization } = useOrganization();
  const [rules, setRules] = useState<TagRule[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRule, setNewRule] = useState({ match_text: "", match_type: "exact" as "exact" | "contains", tag_id: "" });

  useEffect(() => {
    if (open && currentOrganization?.id) {
      loadData();
    }
  }, [open, currentOrganization?.id]);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const [rulesRes, tagsRes] = await Promise.all([
        (supabase as any)
          .from("message_tag_rules")
          .select("id, tag_id, match_text, match_type, active")
          .eq("organization_id", currentOrganization.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("tags")
          .select("id, name, color")
          .eq("organization_id", currentOrganization.id)
          .order("name"),
      ]);
      if (rulesRes.data) setRules(rulesRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
    } catch (e) {
      console.error("Error loading tag rules:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentOrganization?.id) return;
    if (!newRule.match_text.trim() || !newRule.tag_id) {
      toast.error("Preencha o texto e selecione uma etiqueta");
      return;
    }

    try {
      const { error } = await (supabase as any).from("message_tag_rules").insert({
        organization_id: currentOrganization.id,
        tag_id: newRule.tag_id,
        match_text: newRule.match_text.trim(),
        match_type: newRule.match_type,
      });
      if (error) throw error;
      toast.success("Regra criada com sucesso!");
      setNewRule({ match_text: "", match_type: "exact", tag_id: "" });
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar regra");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("message_tag_rules")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    } catch (e: any) {
      toast.error("Erro ao atualizar regra");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("message_tag_rules").delete().eq("id", id);
      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Regra removida");
    } catch (e: any) {
      toast.error("Erro ao remover regra");
    }
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag ? tag.name : "—";
  };

  const getTagColor = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.color || "#888";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Rastreamento por Mensagem
          </DialogTitle>
          <DialogDescription>
            Atribua etiquetas automaticamente quando o lead enviar uma mensagem específica
          </DialogDescription>
        </DialogHeader>

        {/* Create new rule */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="font-semibold">Nova Regra</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Texto da mensagem</Label>
              <Input
                value={newRule.match_text}
                onChange={(e) => setNewRule((p) => ({ ...p, match_text: e.target.value }))}
                placeholder="Ex: Quero comprar"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de correspondência</Label>
              <Select
                value={newRule.match_type}
                onValueChange={(v) => setNewRule((p) => ({ ...p, match_type: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Texto exato</SelectItem>
                  <SelectItem value="contains">Contém na mensagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etiqueta a aplicar</Label>
            <Select
              value={newRule.tag_id}
              onValueChange={(v) => setNewRule((p) => ({ ...p, tag_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Criar Regra
          </Button>
        </div>

        {/* Existing rules */}
        <div className="space-y-2 mt-2">
          <Label className="font-semibold">Regras Ativas ({rules.length})</Label>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma regra criada ainda
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <Switch
                    checked={rule.active}
                    onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">"{rule.match_text}"</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {rule.match_type === "exact" ? "Exato" : "Contém"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: getTagColor(rule.tag_id) }}
                      />
                      <span className="text-xs text-muted-foreground">{getTagName(rule.tag_id)}</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(rule.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
