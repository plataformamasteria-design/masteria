import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, Bot, MessageSquare, Save, Loader2, RotateCcw, ChevronDown, ChevronUp,
  Sparkles, Target, Zap, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPrompt {
  id: string;
  prompt_key: string;
  label: string;
  description: string | null;
  content: string;
  system_message: string | null;
  category: string;
  is_active: boolean;
  updated_at: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  analise_atendimento: { label: 'Análise de Atendimento', icon: UserCheck, color: 'text-blue-500' },
  automacao: { label: 'Automação / Nós I.A', icon: Zap, color: 'text-amber-500' },
  geral: { label: 'Geral', icon: Brain, color: 'text-purple-500' },
};

// Maps prompt_key to the real automation node name it belongs to
const NODE_IDENTIFICATION: Record<string, { nodeName: string; nodeIcon: string }> = {
  classificador_intencoes_system: { nodeName: 'Classificador de Intenções', nodeIcon: '🧭' },
  classificador_intencoes_prompt: { nodeName: 'Classificador de Intenções', nodeIcon: '🧭' },
  pre_verificacao_objetivo_system: { nodeName: 'Agente de I.A (Modo Diálogo)', nodeIcon: '🤖' },
  pre_verificacao_objetivo_prompt: { nodeName: 'Agente de I.A (Modo Diálogo)', nodeIcon: '🤖' },
  humanizacao_system: { nodeName: 'Agente de I.A — Tratar Texto', nodeIcon: '✨' },
  humanizacao_prompt: { nodeName: 'Agente de I.A — Tratar Texto', nodeIcon: '✨' },
  followup_ia_system: { nodeName: 'Follow Up com I.A', nodeIcon: '🔄' },
  analise_atendimento: { nodeName: 'Diagnóstico de Atendimento', nodeIcon: '📊' },
};

export function AIPromptsManager() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, Partial<AIPrompt>>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('global_ai_prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar prompts de I.A');
      console.error(error);
    } else {
      setPrompts(data || []);
    }
    setLoading(false);
  };

  const handleFieldChange = (promptId: string, field: keyof AIPrompt, value: any) => {
    setEditedPrompts(prev => ({
      ...prev,
      [promptId]: { ...prev[promptId], [field]: value },
    }));
  };

  const hasChanges = (promptId: string) => {
    return !!editedPrompts[promptId] && Object.keys(editedPrompts[promptId]).length > 0;
  };

  const handleSave = async (prompt: AIPrompt) => {
    const changes = editedPrompts[prompt.id];
    if (!changes) return;

    setSaving(prompt.id);
    const { error } = await supabase
      .from('global_ai_prompts')
      .update(changes)
      .eq('id', prompt.id);

    if (error) {
      toast.error(`Erro ao salvar "${prompt.label}"`);
      console.error(error);
    } else {
      toast.success(`"${prompt.label}" salvo com sucesso`);
      setEditedPrompts(prev => {
        const next = { ...prev };
        delete next[prompt.id];
        return next;
      });
      fetchPrompts();
    }
    setSaving(null);
  };

  const handleReset = (prompt: AIPrompt) => {
    setEditedPrompts(prev => {
      const next = { ...prev };
      delete next[prompt.id];
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getFieldValue = (prompt: AIPrompt, field: keyof AIPrompt) => {
    return editedPrompts[prompt.id]?.[field] ?? prompt[field];
  };

  const categories = [...new Set(prompts.map(p => p.category))];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Central de Prompts do Sistema</p>
            <p className="text-xs text-muted-foreground">
              Edite os prompts e instruções de sistema usados por todas as I.As da plataforma.
              As alterações são aplicadas globalmente para todas as organizações.
              Use variáveis como <code className="bg-muted px-1 rounded">{'{{variavel}}'}</code> para valores dinâmicos.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs by category */}
      <Tabs defaultValue={categories[0] || 'geral'}>
        <TabsList className="bg-muted/50">
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.geral;
            const Icon = config.icon;
            return (
              <TabsTrigger key={cat} value={cat} className="gap-2 text-xs">
                <Icon className={cn('h-3.5 w-3.5', config.color)} />
                {config.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
            {prompts
              .filter(p => p.category === cat)
              .map(prompt => {
                const isExpanded = expandedCards[prompt.id] ?? true;
                const changed = hasChanges(prompt.id);
                const isSaving = saving === prompt.id;

                return (
                  <Card
                    key={prompt.id}
                    className={cn(
                      'transition-all duration-200',
                      changed && 'ring-1 ring-primary/50 border-primary/30'
                    )}
                  >
                    <CardHeader
                      className="cursor-pointer select-none"
                      onClick={() => toggleExpanded(prompt.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-wrap">
                          <CardTitle className="text-sm font-semibold truncate">
                            {prompt.label}
                          </CardTitle>
                          {NODE_IDENTIFICATION[prompt.prompt_key] && (
                            <Badge variant="secondary" className="text-[10px] gap-1 shrink-0 bg-muted/80 font-normal">
                              <span>{NODE_IDENTIFICATION[prompt.prompt_key].nodeIcon}</span>
                              {NODE_IDENTIFICATION[prompt.prompt_key].nodeName}
                            </Badge>
                          )}
                          {changed && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                              Alterado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Label className="text-[10px] text-muted-foreground">Ativo</Label>
                            <Switch
                              checked={getFieldValue(prompt, 'is_active') as boolean}
                              onCheckedChange={v => handleFieldChange(prompt.id, 'is_active', v)}
                            />
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {prompt.description && (
                        <CardDescription className="text-xs mt-1">
                          {prompt.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-4 pt-0">
                        {/* System Message (if applicable) */}
                        {prompt.system_message !== null && (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                              System Message
                            </Label>
                            <Textarea
                              value={(getFieldValue(prompt, 'system_message') as string) || ''}
                              onChange={e => handleFieldChange(prompt.id, 'system_message', e.target.value)}
                              className="min-h-[80px] text-xs font-mono bg-muted/30"
                              placeholder="System message..."
                            />
                          </div>
                        )}

                        {/* Content / Prompt */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            Conteúdo do Prompt
                          </Label>
                          <Textarea
                            value={(getFieldValue(prompt, 'content') as string) || ''}
                            onChange={e => handleFieldChange(prompt.id, 'content', e.target.value)}
                            className="min-h-[200px] text-xs font-mono bg-muted/30"
                            placeholder="Prompt content..."
                          />
                          <p className="text-[10px] text-muted-foreground">
                            {((getFieldValue(prompt, 'content') as string) || '').length} caracteres
                          </p>
                        </div>

                        {/* Actions */}
                        {changed && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReset(prompt)}
                              disabled={isSaving}
                              className="gap-1.5 text-xs"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Descartar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSave(prompt)}
                              disabled={isSaving}
                              className="gap-1.5 text-xs"
                            >
                              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Salvar
                            </Button>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-3 pt-1">
                          <span>Chave: <code className="bg-muted px-1 rounded">{prompt.prompt_key}</code></span>
                          <span>Atualizado: {new Date(prompt.updated_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
