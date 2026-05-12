import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2, GitBranch, Plus, X } from "lucide-react";

interface FunnelStageAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  currentFunnelId?: string | null;
  currentStageId?: string | null;
  onAssigned?: () => void;
}

interface Funnel { id: string; name: string; }
interface Stage { id: string; name: string; color: string; order_position: number; funnel_id: string; }
interface Assignment { funnelId: string; stageId: string; }

export function FunnelStageAssignDialog({
  open,
  onOpenChange,
  chatId,
  currentFunnelId,
  currentStageId,
  onAssigned,
}: FunnelStageAssignDialogProps) {
  const { currentOrganization } = useOrganization();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [existingFunnelIds, setExistingFunnelIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    setLoading(true);

    Promise.all([
      (supabase as any).from("chat_funnel_stage").select("funnel_id, stage_id").eq("chat_id", chatId),
      (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id).order("created_at"),
      (supabase as any).from("funnel_stages").select("id, name, color, order_position, funnel_id").eq("organization_id", currentOrganization.id).order("order_position"),
    ]).then(([existingRes, fRes, sRes]) => {
      const existing = existingRes.data || [];
      setExistingFunnelIds(new Set(existing.map((e: any) => e.funnel_id)));
      
      if (existing.length > 0) {
        setAssignments(existing.map((e: any) => ({ funnelId: e.funnel_id, stageId: e.stage_id })));
      } else if (currentFunnelId) {
        setAssignments([{ funnelId: currentFunnelId, stageId: currentStageId || '' }]);
      } else {
        setAssignments([{ funnelId: '', stageId: '' }]);
      }
      
      setFunnels(fRes.data || []);
      setStages(sRes.data || []);
      setLoading(false);
    });
  }, [open, currentOrganization?.id]);

  const addAssignment = () => {
    setAssignments(prev => [...prev, { funnelId: '', stageId: '' }]);
  };

  const removeAssignment = (idx: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAssignment = (idx: number, field: 'funnelId' | 'stageId', value: string) => {
    setAssignments(prev => prev.map((a, i) => {
      if (i !== idx) return a;
      if (field === 'funnelId') return { funnelId: value, stageId: '' };
      return { ...a, stageId: value };
    }));
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);

    try {
      const validAssignments = assignments.filter(a => a.funnelId && a.stageId);

      // Upsert all valid assignments
      for (const assignment of validAssignments) {
        const { error } = await (supabase as any).from("chat_funnel_stage").upsert(
          {
            chat_id: chatId,
            funnel_id: assignment.funnelId,
            stage_id: assignment.stageId,
            organization_id: currentOrganization.id,
            moved_at: new Date().toISOString(),
          },
          { onConflict: "chat_id,funnel_id" }
        );
        if (error) throw error;
      }

      // Remove deleted assignments
      const validFunnelIds = new Set(validAssignments.map(a => a.funnelId));
      for (const existingId of existingFunnelIds) {
        if (!validFunnelIds.has(existingId)) {
          const { error } = await (supabase as any).from("chat_funnel_stage")
            .delete()
            .eq("chat_id", chatId)
            .eq("funnel_id", existingId);
          if (error) throw error;
        }
      }

      onAssigned?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("FunnelStageAssign error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Atribuir a Funis
          </DialogTitle>
          <DialogDescription>
            Escolha os funis e etapas para este lead
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
            {assignments.map((assignment, idx) => {
              const filteredStages = stages.filter(s => s.funnel_id === assignment.funnelId);
              return (
                <div key={idx} className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50 relative">
                  {assignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAssignment(idx)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Funil</Label>
                    <Select
                      value={assignment.funnelId}
                      onValueChange={(v) => updateAssignment(idx, 'funnelId', v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione um funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {funnels
                          .filter(f => f.id === assignment.funnelId || !assignments.some((a, i) => i !== idx && a.funnelId === f.id))
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignment.funnelId && filteredStages.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Etapa</Label>
                      <Select value={assignment.stageId} onValueChange={(v) => updateAssignment(idx, 'stageId', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione uma etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}

            {assignments.length < funnels.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={addAssignment}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar a outro funil
              </Button>
            )}

            {funnels.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum funil criado. Crie um funil na aba CRM primeiro.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="px-6 pb-6 pt-3 gap-2 sm:gap-0 shrink-0 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || assignments.every(a => !a.funnelId || !a.stageId)}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
