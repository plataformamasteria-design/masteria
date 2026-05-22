'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Zap, ArrowLeft, Loader2, GripVertical, Plus, Trash2, AlertCircle, Link2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type StageType = 'NEUTRAL' | 'WIN' | 'LOSS';
type SemanticType = 'meeting_scheduled' | 'meeting_cancelled' | 'payment_received' | 'proposal_sent';

interface Stage {
  id: string;
  title: string;
  type: StageType;
  semanticType?: SemanticType;
}

interface FunnelType {
  value: 'LEAD_CAPTURE' | 'SALES' | 'CUSTOMER_SUCCESS' | 'RETENTION';
  label: string;
  description: string;
}

const FUNNEL_TYPES: FunnelType[] = [
  { value: 'LEAD_CAPTURE', label: 'Captação de Leads', description: 'Para capturar e qualificar novos leads' },
  { value: 'SALES', label: 'Vendas', description: 'Para gerenciar o processo de vendas' },
  { value: 'CUSTOMER_SUCCESS', label: 'Customer Success', description: 'Para acompanhar clientes ativos' },
  { value: 'RETENTION', label: 'Retenção', description: 'Para evitar cancelamentos e reter clientes' },
];

const SEMANTIC_TYPES = [
  { value: 'NONE', label: 'Nenhum (Padrão)' },
  { value: 'meeting_scheduled', label: '📅 Reunião Marcada' },
  { value: 'meeting_cancelled', label: '🚫 Agendamento Desmarcado' },
  { value: 'proposal_sent', label: '📄 Proposta Enviada' },
  { value: 'payment_received', label: '💰 Pagamento Recebido' },
];

interface ConnectionOption {
  id: string;
  config_name: string;
  phoneNumber?: string | null;
  phone?: string | null;
  connectionType: string;
  isActive: boolean;
}

export default function EditFunnelPage({ params }: { params: Promise<{ funnelId: string }> }) {
  const { funnelId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [funnelName, setFunnelName] = useState('');
  const [funnelType, setFunnelType] = useState<string>('');
  const [objective, setObjective] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [availableConnections, setAvailableConnections] = useState<ConnectionOption[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  const [settings, setSettings] = useState({
    autoAssignTeamId: '',
    autoAssignUserId: '',
    autoTriggerAutomationId: '',
    autoTags: [] as string[],
    defaultEntryStageId: '',
  });

  // Carregar dados do funil e conexões
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [funnelRes, connectionsRes, teamsRes, automationsRes, tagsRes] = await Promise.all([
          fetch(`/api/v1/kanbans/${funnelId}`),
          fetch('/api/v1/connections'),
          fetch('/api/v1/team'),
          fetch('/api/v1/automations'),
          fetch('/api/v1/tags'),
        ]);

        if (!funnelRes.ok) throw new Error('Falha ao carregar funil');

        const data = await funnelRes.json();
        setFunnelName(data.name);
        setFunnelType(data.funnelType || '');
        setObjective(data.objective || '');
        setSelectedConnectionIds(data.connectionIds || []);
        setStages(data.stages.map((s: Stage) => ({
          ...s,
          semanticType: s.semanticType || undefined
        })));
        if (data.settings) {
          setSettings({
            autoAssignTeamId: data.settings.autoAssignTeamId || '',
            autoAssignUserId: data.settings.autoAssignUserId || '',
            autoTriggerAutomationId: data.settings.autoTriggerAutomationId || '',
            autoTags: data.settings.autoTags || [],
            defaultEntryStageId: data.settings.defaultEntryStageId || '',
          });
        }

        const connData = await connectionsRes.json();
        setAvailableConnections(Array.isArray(connData) ? connData.filter((c: ConnectionOption) => c.isActive) : []);
        
        if (teamsRes.ok) { 
           const td = await teamsRes.json(); 
           setTeams(Array.isArray(td.teams) ? td.teams : (Array.isArray(td) ? td : [])); 
           setUsers(Array.isArray(td.members) ? td.members : []); 
        }
        if (automationsRes.ok) { const ad = await automationsRes.json(); setAutomations(Array.isArray(ad.data) ? ad.data : []); }
        if (tagsRes.ok) { const tg = await tagsRes.json(); setTags(Array.isArray(tg) ? tg : []); }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: (error as Error).message
        });
        router.push('/kanban');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [funnelId, router, toast]);

  const toggleConnection = (connId: string) => {
    setSelectedConnectionIds(prev =>
      prev.includes(connId) ? prev.filter(id => id !== connId) : [...prev, connId]
    );
  };

  const toggleTag = (tagId: string) => {
    setSettings(prev => ({
      ...prev,
      autoTags: prev.autoTags.includes(tagId) ? prev.autoTags.filter(id => id !== tagId) : [...prev.autoTags, tagId]
    }));
  };

  const addStage = () => {
    setStages([...stages, { id: uuidv4(), title: '', type: 'NEUTRAL' }]);
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'É necessário pelo menos um estágio no funil'
      });
      return;
    }
    setStages(stages.filter(s => s.id !== id));
  };

  const updateStage = (id: string, field: keyof Stage, value: string) => {
    // Converter 'NONE' para undefined para semanticType
    const actualValue = (field === 'semanticType' && value === 'NONE') ? undefined : value;
    setStages(stages.map(s => s.id === id ? { ...s, [field]: actualValue } : s));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;
    items.splice(result.destination.index, 0, reorderedItem);

    setStages(items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!funnelName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nome do funil é obrigatório'
      });
      return;
    }

    if (stages.some(s => !s.title.trim())) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Todos os estágios precisam ter um título'
      });
      return;
    }

    // Validar semanticType único (excluir valores vazios/undefined)
    const semanticTypes = stages.reduce<SemanticType[]>((acc, stage) => {
      if (stage.semanticType) acc.push(stage.semanticType);
      return acc;
    }, []);

    const duplicates = semanticTypes.filter((item, index) => semanticTypes.indexOf(item) !== index);
    if (duplicates.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Cada tipo semântico pode ser usado apenas uma vez no funil'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/kanbans/${funnelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: funnelName,
          funnelType: funnelType || null,
          objective: objective || null,
          stages: stages.map(s => ({
            ...s,
            semanticType: s.semanticType === 'NONE' ? undefined : s.semanticType,
            entryAutomationId: s.entryAutomationId || undefined
          })),
          connectionIds: selectedConnectionIds.length > 0 ? selectedConnectionIds : null,
          settings: {
            autoAssignTeamId: settings.autoAssignTeamId || null,
            autoAssignUserId: settings.autoAssignUserId || null,
            autoTriggerAutomationId: settings.autoTriggerAutomationId || null,
            autoTags: settings.autoTags,
            defaultEntryStageId: settings.defaultEntryStageId || null,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao atualizar funil');
      }

      toast({
        title: 'Sucesso!',
        description: 'Funil atualizado com sucesso'
      });

      router.push(`/kanban/${funnelId}`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link href={`/kanban/${funnelId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para o Funil
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar Funil Kanban</CardTitle>
          <CardDescription>
            Configure os estágios e automações do seu funil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Funil *</Label>
              <Input
                id="name"
                placeholder="Ex: Pipeline de Vendas"
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="funnelType">Tipo de Funil (opcional)</Label>
              <Select value={funnelType} onValueChange={setFunnelType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de funil..." />
                </SelectTrigger>
                <SelectContent>
                  {FUNNEL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {funnelType && (
                <p className="text-sm text-muted-foreground">
                  {FUNNEL_TYPES.find(t => t.value === funnelType)?.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo (opcional)</Label>
              <Input
                id="objective"
                placeholder="Ex: Aumentar conversão em 20%"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>

            {/* Conexões Vinculadas */}
            {availableConnections.length > 0 && (
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Conexões Vinculadas (opcional)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Contatos que chegarem por essas conexões serão adicionados automaticamente como leads neste funil
                  </p>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  {availableConnections.map(conn => (
                    <label
                      key={conn.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedConnectionIds.includes(conn.id)}
                        onCheckedChange={() => toggleConnection(conn.id)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{conn.config_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {conn.phoneNumber || conn.phone || 'Sem número'} · {conn.connectionType === 'meta_api' ? 'Meta API' : 'Baileys'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Configurações de Entrada do Funil */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-lg font-semibold">Automações de Entrada (Opcional)</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Configure o que deve acontecer automaticamente quando um lead entrar neste funil.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Atribuir a Usuário Específico</Label>
                  <Select value={settings.autoAssignUserId} onValueChange={(val) => setSettings(s => ({ ...s, autoAssignUserId: val === 'none' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum Usuário..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum Usuário</SelectItem>
                      {users.map(u => <SelectItem key={u.id || u.user?.id} value={u.id || u.user?.id}>{u.name || u.user?.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Disparar Fluxo de Automação</Label>
                  <Select value={settings.autoTriggerAutomationId} onValueChange={(val) => setSettings(s => ({ ...s, autoTriggerAutomationId: val === 'none' ? '' : val }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhum Fluxo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum Fluxo</SelectItem>
                      {automations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tags.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label>Adicionar Tags Automaticamente</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                    {tags.map(t => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer bg-muted/50 p-2 rounded-md hover:bg-muted transition-colors text-sm">
                        <Checkbox 
                          checked={settings.autoTags.includes(t.id)} 
                          onCheckedChange={() => toggleTag(t.id)} 
                        />
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#cbd5e1' }} />
                          {t.name}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>Estágios do Funil *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Estágio
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tipos Semânticos:</strong> Configure automações inteligentes marcando etapas especiais.
                  Por exemplo, marque uma etapa como &quot;Reunião Marcada&quot; para que leads sejam movidos automaticamente
                  quando a IA detectar agendamento de reunião na conversa.
                </AlertDescription>
              </Alert>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="stages">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {stages.map((stage, index) => (
                        <Draggable key={stage.id} draggableId={stage.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                              className={`space-y-2 p-4 border rounded-lg transition-colors ${snapshot.isDragging
                                ? 'bg-primary/10 border-primary shadow-lg'
                                : 'bg-muted/30'
                                }`}
                            >
                              <div className="flex gap-2 items-start">
                                <div {...provided.dragHandleProps} className="pt-5 cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <Label className="text-xs text-muted-foreground">Título do Estágio</Label>
                                  <Input
                                    placeholder={`Estágio ${index + 1}`}
                                    value={stage.title}
                                    onChange={(e) => updateStage(stage.id, 'title', e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="w-[140px]">
                                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                                  <Select
                                    value={stage.type}
                                    onValueChange={(value: StageType) => updateStage(stage.id, 'type', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NEUTRAL">Neutro</SelectItem>
                                      <SelectItem value="WIN">Vitória</SelectItem>
                                      <SelectItem value="LOSS">Perda</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="pt-5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStage(stage.id)}
                                    disabled={stages.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Tipo Semântico (Automação)</Label>
                                  <Select
                                    value={stage.semanticType || 'NONE'}
                                    onValueChange={(value: SemanticType | 'NONE') => updateStage(stage.id, 'semanticType', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">Nenhum</SelectItem>
                                      {SEMANTIC_TYPES.map((st) => (
                                        <SelectItem key={st.value} value={st.value}>
                                          {st.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> Automação ao Entrar na Etapa</Label>
                                  <Select
                                    value={stage.entryAutomationId || 'none'}
                                    onValueChange={(value: string) => updateStage(stage.id, 'entryAutomationId', value === 'none' ? undefined : value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Nenhum fluxo selecionado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhum fluxo</SelectItem>
                                      {automations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-muted-foreground/10 flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                                  <input 
                                    type="radio" 
                                    name="defaultEntryStage" 
                                    checked={settings.defaultEntryStageId === stage.id || (!settings.defaultEntryStageId && index === 0)}
                                    onChange={() => setSettings(s => ({ ...s, defaultEntryStageId: stage.id }))}
                                    className="accent-primary w-4 h-4"
                                  />
                                  Definir como Etapa Padrão de Entrada (Leads Novos)
                                </label>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Link href={`/kanban/${funnelId}`}>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
