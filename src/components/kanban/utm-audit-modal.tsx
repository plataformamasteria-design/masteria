// src/components/kanban/utm-audit-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Loader2, AlertTriangle, CheckCircle2, ArrowRight, MoveRight,
  Search, Settings2, Plus, Trash2, ChevronRight, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { UtmRoutingRule } from '@/lib/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StageOption { id: string; title: string; }
interface AvailableBoard { id: string; name: string; }

interface MismatchItem {
  leadId: string;
  stageId: string;
  currentStageName: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  utmCampaign: string;
  matchedRuleId: string;
  matchedRuleLabel: string;
  suggestedBoardId: string;
  suggestedBoardName: string;
  suggestedStageId: string | null;
  suggestedStageName: string | null;
  suggestedStageOptions: StageOption[];
}

interface AuditData {
  boardId: string;
  boardName: string;
  totalLeads: number;
  totalWithUtm: number;
  mismatchCount: number;
  mismatches: MismatchItem[];
  usingDefaultRules: boolean;
}

interface UtmAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onMoved?: () => void;
}

type Tab = 'diagnosis' | 'rules';

// ─── Group mismatches by destination board ───────────────────────────────────
function groupByBoard(mismatches: MismatchItem[]): Map<string, MismatchItem[]> {
  const map = new Map<string, MismatchItem[]>();
  for (const m of mismatches) {
    if (!map.has(m.suggestedBoardId)) map.set(m.suggestedBoardId, []);
    map.get(m.suggestedBoardId)!.push(m);
  }
  return map;
}

// ─── Diagnosis Tab ────────────────────────────────────────────────────────────
function DiagnosisTab({
  loading, auditData, selected, stageOverrides, onToggleLead, onToggleAll, onStageOverride, onMove, moving,
}: {
  loading: boolean;
  auditData: AuditData | null;
  selected: Set<string>;
  stageOverrides: Map<string, string>; // leadId → stageId override
  onToggleLead: (id: string) => void;
  onToggleAll: () => void;
  onStageOverride: (leadId: string, stageId: string) => void;
  onMove: () => void;
  moving: boolean;
}) {
  const grouped = auditData ? groupByBoard(auditData.mismatches) : new Map();

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Analisando leads do funil...</p>
    </div>
  );

  if (!auditData) return null;

  return (
    <div className="space-y-4 p-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total de Leads', value: auditData.totalLeads },
          { label: 'Com UTM Campaign', value: auditData.totalWithUtm },
          { label: 'Fora do lugar', value: auditData.mismatchCount, highlight: auditData.mismatchCount > 0 },
        ].map(s => (
          <div key={s.label} className={cn(
            'rounded-lg border p-3 text-center',
            s.highlight ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-muted/30'
          )}>
            <div className={cn('text-xl font-bold', s.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {s.value}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {auditData.usingDefaultRules && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-[11px] text-blue-600 dark:text-blue-400">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>Usando regras padrão. Configure regras personalizadas na aba <strong>Configurar Regras</strong>.</span>
        </div>
      )}

      {auditData.mismatchCount === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm font-semibold">Todos os leads estão no funil correto!</p>
        </div>
      )}

      {auditData.mismatchCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Leads no funil errado</span>
            </div>
            <button onClick={onToggleAll} className="text-[11px] text-primary hover:underline">
              {selected.size === auditData.mismatches.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          {[...grouped.entries()].map(([boardId, items]) => {
            const first = items[0];
            const selectedInGroup = items.filter(i => selected.has(i.leadId)).length;
            // Check if all leads in group have a matching stage
            const allHaveStage = items.every(i => i.suggestedStageId !== null);

            return (
              <div key={boardId} className="border border-border rounded-lg overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border flex-wrap gap-y-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">Mover para:</span>
                  <Badge className="text-[11px] border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 px-2 py-0">
                    {first.suggestedBoardName}
                  </Badge>
                  {!allHaveStage && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">
                      ⚠ Algumas etapas precisam de seleção manual
                    </span>
                  )}
                  <Badge className="ml-auto h-4 px-1.5 text-[10px] bg-muted border border-border text-muted-foreground">
                    {selectedInGroup}/{items.length}
                  </Badge>
                </div>

                {/* Lead rows */}
                <div className="divide-y divide-border/50">
                  {items.map(m => {
                    const isSelected = selected.has(m.leadId);
                    const needsManualStage = m.suggestedStageId === null;
                    const currentOverride = stageOverrides.get(m.leadId);
                    const resolvedStageId = currentOverride ?? m.suggestedStageId;

                    return (
                      <div key={m.leadId} className={cn(
                        'flex items-start gap-3 px-3 py-2.5 transition-colors',
                        isSelected ? 'bg-primary/5' : 'bg-background'
                      )}>
                        {/* Checkbox */}
                        <button
                          onClick={() => onToggleLead(m.leadId)}
                          className={cn(
                            'h-4 w-4 mt-1 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                            isSelected ? 'bg-primary border-primary' : 'border-border bg-background'
                          )}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[13px] truncate">{m.contactName || '(sem nome)'}</span>
                            {m.contactPhone && <span className="text-[11px] text-muted-foreground">{m.contactPhone}</span>}
                          </div>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono truncate">{m.utmCampaign}</p>

                          {/* Stage mapping */}
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {m.currentStageName}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {needsManualStage ? (
                              <Select
                                value={currentOverride ?? ''}
                                onValueChange={v => onStageOverride(m.leadId, v)}
                              >
                                <SelectTrigger className="h-6 text-[11px] w-40 border-amber-500/40 bg-amber-500/5">
                                  <SelectValue placeholder="Escolher etapa..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {m.suggestedStageOptions.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select
                                value={resolvedStageId ?? m.suggestedStageId!}
                                onValueChange={v => onStageOverride(m.leadId, v)}
                              >
                                <SelectTrigger className="h-6 text-[11px] w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {m.suggestedStageOptions.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────
function RulesTab({
  rules, availableBoards, onChange,
}: {
  rules: UtmRoutingRule[];
  availableBoards: AvailableBoard[];
  onChange: (rules: UtmRoutingRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, {
      id: crypto.randomUUID(),
      pattern: '',
      isRegex: false,
      targetBoardId: '',
      targetBoardName: '',
      isActive: true,
      label: '',
    }]);
  };

  const updateRule = (id: string, patch: Partial<UtmRoutingRule>) => {
    onChange(rules.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...patch };
      // Sync targetBoardName from board selection
      if (patch.targetBoardId) {
        const board = availableBoards.find(b => b.id === patch.targetBoardId);
        updated.targetBoardName = board?.name ?? '';
      }
      return updated;
    }));
  };

  const removeRule = (id: string) => onChange(rules.filter(r => r.id !== id));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Regras de Atribuição UTM</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configure quais padrões de UTM Campaign indicam cada funil.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={addRule}>
          <Plus className="h-3.5 w-3.5" /> Nova Regra
        </Button>
      </div>

      {rules.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Nenhuma regra configurada. Usando regras padrão do sistema.
          <br />
          <button onClick={addRule} className="text-primary hover:underline mt-2 text-xs">
            Adicionar primeira regra →
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="border border-border rounded-lg p-3 space-y-2.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Regra #{idx + 1}</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`rule-active-${rule.id}`}
                    checked={rule.isActive}
                    onCheckedChange={v => updateRule(rule.id, { isActive: v })}
                    className="scale-75"
                  />
                  <Label htmlFor={`rule-active-${rule.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
                    {rule.isActive ? 'Ativa' : 'Inativa'}
                  </Label>
                </div>
                <button onClick={() => removeRule(rule.id)} className="text-destructive/70 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Label */}
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Nome da regra (opcional)</Label>
              <Input
                className="h-7 text-xs"
                placeholder="Ex: Encontro de Negócios"
                value={rule.label ?? ''}
                onChange={e => updateRule(rule.id, { label: e.target.value })}
              />
            </div>

            {/* Pattern */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] text-muted-foreground">Padrão de busca na UTM</Label>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`rule-regex-${rule.id}`}
                    checked={rule.isRegex}
                    onCheckedChange={v => updateRule(rule.id, { isRegex: v })}
                    className="scale-75"
                  />
                  <Label htmlFor={`rule-regex-${rule.id}`} className="text-[10px] text-muted-foreground cursor-pointer">
                    Regex
                  </Label>
                </div>
              </div>
              <Input
                className="h-7 text-xs font-mono"
                placeholder={rule.isRegex ? 'encontro de neg[oó]cios' : 'ENCONTRO DE NEGÓCIOS'}
                value={rule.pattern}
                onChange={e => updateRule(rule.id, { pattern: e.target.value })}
              />
            </div>

            {/* Target board */}
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Funil destino</Label>
              <Select
                value={rule.targetBoardId}
                onValueChange={v => updateRule(rule.id, { targetBoardId: v })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Selecionar funil..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBoards.map(b => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function UtmAuditModal({ open, onOpenChange, boardId, onMoved }: UtmAuditModalProps) {
  const [tab, setTab] = useState<Tab>('diagnosis');
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stageOverrides, setStageOverrides] = useState<Map<string, string>>(new Map());
  const [rules, setRules] = useState<UtmRoutingRule[]>([]);
  const [availableBoards, setAvailableBoards] = useState<AvailableBoard[]>([]);
  const { toast } = useToast();

  const fetchAudit = useCallback(async () => {
    if (!open || !boardId) return;
    setLoading(true);
    setAuditData(null);
    setSelected(new Set());
    setStageOverrides(new Map());
    try {
      const res = await fetch(`/api/v1/leads/utm-audit?boardId=${boardId}`);
      if (!res.ok) throw new Error('Falha ao carregar diagnóstico');
      const data: AuditData = await res.json();
      setAuditData(data);
      setSelected(new Set(data.mismatches.map(m => m.leadId)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [open, boardId, toast]);

  const fetchRules = useCallback(async () => {
    if (!open) return;
    try {
      const res = await fetch('/api/v1/utm-routing-rules');
      if (!res.ok) return;
      const data = await res.json();
      setRules(data.rules ?? []);
      setAvailableBoards(data.availableBoards ?? []);
    } catch { /* silent */ }
  }, [open]);

  useEffect(() => {
    fetchAudit();
    fetchRules();
  }, [fetchAudit, fetchRules]);

  const toggleAll = () => {
    if (!auditData) return;
    setSelected(selected.size === auditData.mismatches.length
      ? new Set()
      : new Set(auditData.mismatches.map(m => m.leadId))
    );
  };

  const toggleLead = (leadId: string) => {
    const next = new Set(selected);
    next.has(leadId) ? next.delete(leadId) : next.add(leadId);
    setSelected(next);
  };

  const handleStageOverride = (leadId: string, stageId: string) => {
    setStageOverrides(prev => new Map(prev).set(leadId, stageId));
  };

  const handleMove = async () => {
    if (!auditData || selected.size === 0) return;
    const selectedMismatches = auditData.mismatches.filter(m => selected.has(m.leadId));

    // Build individual moves — respecting overrides and auto-matched stages
    const moves = selectedMismatches.map(m => ({
      leadId: m.leadId,
      targetBoardId: m.suggestedBoardId,
      targetStageId: stageOverrides.get(m.leadId) ?? m.suggestedStageId ?? '',
    })).filter(m => m.targetStageId !== '');

    if (moves.length < selectedMismatches.length) {
      toast({
        variant: 'destructive',
        title: 'Etapas pendentes',
        description: 'Selecione manualmente a etapa de destino para todos os leads selecionados.',
      });
      return;
    }

    setMoving(true);
    try {
      const res = await fetch('/api/v1/leads/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const result = await res.json();
      toast({ title: '✅ Leads movidos!', description: `${result.moved} lead(s) realocados com sucesso.` });
      await fetchAudit();
      onMoved?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao mover', description: (e as Error).message });
    } finally {
      setMoving(false);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch('/api/v1/utm-routing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: '✅ Regras salvas!', description: 'O diagnóstico será recarregado com as novas regras.' });
      setTab('diagnosis');
      await fetchAudit();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: (e as Error).message });
    } finally {
      setSavingRules(false);
    }
  };

  const selectedCount = selected.size;
  const needsManualCount = auditData?.mismatches.filter(
    m => selected.has(m.leadId) && m.suggestedStageId === null && !stageOverrides.has(m.leadId)
  ).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 bg-background border border-border">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-0 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-amber-500" />
            <DialogTitle className="text-base font-semibold">Diagnóstico UTM Campaign</DialogTitle>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 mt-3 border-b border-border">
            {([
              { key: 'diagnosis', label: 'Diagnóstico', icon: AlertTriangle },
              { key: 'rules', label: 'Configurar Regras', icon: Settings2 },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'diagnosis' && (
            <DiagnosisTab
              loading={loading}
              auditData={auditData}
              selected={selected}
              stageOverrides={stageOverrides}
              onToggleLead={toggleLead}
              onToggleAll={toggleAll}
              onStageOverride={handleStageOverride}
              onMove={handleMove}
              moving={moving}
            />
          )}
          {tab === 'rules' && (
            <RulesTab
              rules={rules}
              availableBoards={availableBoards}
              onChange={setRules}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border flex-shrink-0 bg-muted/20">
          {tab === 'diagnosis' && auditData && auditData.mismatchCount > 0 ? (
            <>
              <div className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedCount}</span> selecionado(s)
                {needsManualCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">· {needsManualCount} sem etapa definida</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)} disabled={moving}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={handleMove}
                  disabled={moving || selectedCount === 0 || needsManualCount > 0}
                >
                  {moving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Movendo...</>
                    : <><MoveRight className="h-3.5 w-3.5" /> Mover {selectedCount} lead(s)</>}
                </Button>
              </div>
            </>
          ) : tab === 'rules' ? (
            <>
              <p className="text-[11px] text-muted-foreground">{rules.length} regra(s) configurada(s)</p>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleSaveRules}
                disabled={savingRules}
              >
                {savingRules ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                  : 'Salvar Regras'}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
