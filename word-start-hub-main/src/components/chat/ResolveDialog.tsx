import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Loader2, GitBranch, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ScrollArea } from '@/components/ui/scroll-area';

export type ResolutionOutcome = 'client' | 'not_client' | 'postponed';

interface ResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (outcome: ResolutionOutcome, notes?: string, lossReason?: string) => Promise<void>;
  chatName?: string;
  chatId?: string;
}

interface Funnel { id: string; name: string; }
interface Stage { id: string; name: string; color: string; order_position: number; funnel_id: string; }

interface FunnelAssignment {
  funnelId: string;
  stageId: string;
}

export const ResolveDialog: React.FC<ResolveDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  chatName,
  chatId,
}) => {
  const [outcome, setOutcome] = useState<ResolutionOutcome>('client');
  const [notes, setNotes] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [assignments, setAssignments] = useState<FunnelAssignment[]>([]);
  const [existingFunnelIds, setExistingFunnelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !currentOrganization?.id || !chatId) return;

    Promise.all([
      (supabase as any).from("chat_funnel_stage").select("funnel_id, stage_id").eq("chat_id", chatId),
      (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id).order("created_at"),
      (supabase as any).from("funnel_stages").select("id, name, color, order_position, funnel_id").eq("organization_id", currentOrganization.id).order("order_position"),
    ]).then(([existingRes, fRes, sRes]) => {
      const existing = existingRes.data || [];
      setExistingFunnelIds(new Set(existing.map((e: any) => e.funnel_id)));
      setAssignments(existing.map((e: any) => ({ funnelId: e.funnel_id, stageId: e.stage_id })));
      setFunnels(fRes.data || []);
      setStages(sRes.data || []);
    });
  }, [open, currentOrganization?.id, chatId]);

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

  // Funnels already used in other assignment rows
  const usedFunnelIds = new Set(assignments.map(a => a.funnelId).filter(Boolean));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (chatId && currentOrganization?.id) {
        // Save all funnel assignments
        const validAssignments = assignments.filter(a => a.funnelId && a.stageId);
        for (const assignment of validAssignments) {
          await (supabase as any).from("chat_funnel_stage").upsert(
            {
              chat_id: chatId,
              funnel_id: assignment.funnelId,
              stage_id: assignment.stageId,
              organization_id: currentOrganization.id,
              moved_at: new Date().toISOString(),
            },
            { onConflict: "chat_id,funnel_id" }
          );
        }

        // Remove assignments that were deleted
        const validFunnelIds = new Set(validAssignments.map(a => a.funnelId));
        for (const existingId of existingFunnelIds) {
          if (!validFunnelIds.has(existingId)) {
            await (supabase as any).from("chat_funnel_stage")
              .delete()
              .eq("chat_id", chatId)
              .eq("funnel_id", existingId);
          }
        }
      }

      await onConfirm(outcome, notes.trim() || undefined, outcome === 'not_client' ? lossReason || undefined : undefined);
      setNotes('');
      setLossReason('');
      setOutcome('client');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const options = [
    {
      value: 'client' as ResolutionOutcome,
      label: 'Virou Cliente',
      description: 'Lead converteu em venda (Ganho)',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-500',
    },
    {
      value: 'not_client' as ResolutionOutcome,
      label: 'Não se tornou Cliente',
      description: 'Lead não converteu (Perda)',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-500',
    },
    {
      value: 'postponed' as ResolutionOutcome,
      label: 'Adiou a Decisão',
      description: 'Lead ainda está em consideração',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-500',
    },
  ];

  const availableFunnels = funnels;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Finalizar Atendimento
          </DialogTitle>
          <DialogDescription>
            {chatName
              ? `Qual foi o desfecho da conversa com ${chatName}?`
              : 'Qual foi o desfecho desta conversa?'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-4 px-6 py-4">
            <RadioGroup
              value={outcome}
              onValueChange={(value) => setOutcome(value as ResolutionOutcome)}
              className="space-y-3"
            >
              {options.map((option) => {
                const Icon = option.icon;
                const isSelected = outcome === option.value;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                      isSelected
                        ? cn(option.bgColor, option.borderColor)
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Icon className={cn('h-5 w-5', option.color)} />
                    <div className="flex-1">
                      <Label
                        htmlFor={option.value}
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Adicione notas sobre o atendimento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Motivo da perda (quando não converteu) */}
            {outcome === 'not_client' && (
              <div className="space-y-2">
                <Label>Motivo da Perda</Label>
                <Select value={lossReason} onValueChange={setLossReason}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">💰 Preço</SelectItem>
                    <SelectItem value="timing">⏰ Timing / Momento ruim</SelectItem>
                    <SelectItem value="competitor">🏢 Concorrência</SelectItem>
                    <SelectItem value="no_need">🚫 Sem necessidade</SelectItem>
                    <SelectItem value="no_response">📵 Sem resposta</SelectItem>
                    <SelectItem value="other">📝 Outro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Multiple Funnel Assignment Section */}
            {chatId && availableFunnels.length > 0 && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-violet-500" />
                    <Label className="font-medium text-sm">Funis</Label>
                  </div>
                  {assignments.length < availableFunnels.length && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={addAssignment}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar Funil
                    </Button>
                  )}
                </div>

                {assignments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhum funil atribuído.{" "}
                    <button type="button" className="text-primary underline" onClick={addAssignment}>
                      Adicionar
                    </button>
                  </p>
                )}

                {assignments.map((assignment, idx) => {
                  const filteredStages = stages.filter(s => s.funnel_id === assignment.funnelId);
                  return (
                    <div key={idx} className="space-y-2 p-2 rounded-md bg-background/50 border border-border/30 relative">
                      <button
                        type="button"
                        onClick={() => removeAssignment(idx)}
                        className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Select
                        value={assignment.funnelId}
                        onValueChange={(v) => updateAssignment(idx, 'funnelId', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione um funil" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFunnels
                            .filter(f => f.id === assignment.funnelId || !usedFunnelIds.has(f.id) || !assignments.some((a, i) => i !== idx && a.funnelId === f.id))
                            .map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {assignment.funnelId && filteredStages.length > 0 && (
                        <Select value={assignment.stageId} onValueChange={(v) => updateAssignment(idx, 'stageId', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione uma etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredStages.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                  {s.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 gap-2 sm:gap-0 shrink-0 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Resolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
