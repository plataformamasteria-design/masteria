'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Loader2, UserCircle, Users } from 'lucide-react';
import type { KanbanStage } from '@/lib/types';

interface StagePersonaConfig {
  id?: string;
  boardId: string;
  stageId: string | null;
  activePersonaId: string | null;
  passivePersonaId: string | null;
  activeDisabled?: boolean;
  passiveDisabled?: boolean;
  activePersona?: { id: string; name: string };
  passivePersona?: { id: string; name: string };
}

interface Persona {
  id: string;
  name: string;
  provider: string;
  model: string;
}

interface StagePersonaConfigProps {
  boardId: string;
  stages: KanbanStage[];
  funnelType?: string;
}

export function StagePersonaConfig({ boardId, stages, funnelType }: StagePersonaConfigProps) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [configs, setConfigs] = useState<StagePersonaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [boardId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [personasRes, configsRes] = await Promise.all([
        fetch('/api/v1/ia/personas'),
        fetch(`/api/v1/kanban/stage-personas?boardId=${boardId}`)
      ]);

      if (personasRes.ok) {
        const data = await personasRes.json();
        setPersonas(data);
      }

      if (configsRes.ok) {
        const data = await configsRes.json();
        setConfigs(data);
      }
    } catch (error) {
      notify.error('Erro', 'Falha ao carregar dados de configuração');
    } finally {
      setLoading(false);
    }
  };

  const getConfigForStage = (stageId: string | null): StagePersonaConfig | undefined => {
    return configs.find(c => c.stageId === stageId);
  };

  const handleSave = async (stageId: string | null, type: 'active' | 'passive', personaId: string | null) => {
    setSaving(`${stageId || 'funnel'}-${type}`);
    try {
      const existing = getConfigForStage(stageId);
      const payload = {
        boardId,
        stageId,
        activePersonaId: type === 'active' ? personaId : existing?.activePersonaId,
        passivePersonaId: type === 'passive' ? personaId : existing?.passivePersonaId,
      };

      const response = await fetch('/api/v1/kanban/stage-personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Falha ao salvar');

      notify.success('Sucesso', 'Configuração salva com sucesso');

      await loadData();
    } catch (error) {
      notify.error('Erro', 'Falha ao salvar configuração');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Agentes IA por Estágio</CardTitle>
        <CardDescription>
          Configure agentes diferentes para contatos ativos (outbound) e passivos (inbound) em cada estágio do funil
          {funnelType && <span className="ml-2 text-primary font-medium">({funnelType})</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed rounded-lg p-4 space-y-4 bg-primary/5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">🎯 Configuração Padrão do Funil</h3>
            <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
              Fallback Global
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Estes agentes serão usados quando não houver configuração específica para o estágio do lead
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-blue-600" />
                Agente Padrão (Contato Ativo)
              </Label>
              <div className="flex gap-2">
                <Select
                  value={getConfigForStage(null)?.activeDisabled ? '__INACTIVE__' : (getConfigForStage(null)?.activePersonaId || undefined)}
                  onValueChange={(value) => handleSave(null, 'active', value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__INACTIVE__">
                      🚫 Inativo (Robô Desativado)
                    </SelectItem>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        {persona.name} ({persona.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saving === 'funnel-active' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                Agente Padrão (Contato Passivo)
              </Label>
              <div className="flex gap-2">
                <Select
                  value={getConfigForStage(null)?.passiveDisabled ? '__INACTIVE__' : (getConfigForStage(null)?.passivePersonaId || undefined)}
                  onValueChange={(value) => handleSave(null, 'passive', value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__INACTIVE__">
                      🚫 Inativo (Robô Desativado)
                    </SelectItem>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        {persona.name} ({persona.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saving === 'funnel-passive' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-medium mb-4">Configurações por Estágio</h4>
          <div className="space-y-4">
            {stages.map((stage) => {
              const config = getConfigForStage(stage.id);

              return (
                <div
                  key={stage.id}
                  className="border rounded-lg p-4 space-y-4 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-lg">{stage.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${stage.type === 'WIN' ? 'bg-green-100 text-green-700' :
                      stage.type === 'LOSS' ? 'bg-red-100 text-red-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                      {stage.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-blue-600" />
                        Agente (Contato Ativo - Outbound)
                      </Label>
                      <div className="flex gap-2">
                        <Select
                          value={config?.activeDisabled ? '__INACTIVE__' : (config?.activePersonaId || undefined)}
                          onValueChange={(value) => handleSave(stage.id, 'active', value || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um agente..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__INACTIVE__">
                              🚫 Inativo (Robô Desativado)
                            </SelectItem>
                            {personas.map((persona) => (
                              <SelectItem key={persona.id} value={persona.id}>
                                {persona.name} ({persona.provider})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {saving === `${stage.id}-active` && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Usado quando o agente inicia contato (campanhas, mensagens avulsas)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600" />
                        Agente (Contato Passivo - Inbound)
                      </Label>
                      <div className="flex gap-2">
                        <Select
                          value={config?.passiveDisabled ? '__INACTIVE__' : (config?.passivePersonaId || undefined)}
                          onValueChange={(value) => handleSave(stage.id, 'passive', value || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um agente..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__INACTIVE__">
                              🚫 Inativo (Robô Desativado)
                            </SelectItem>
                            {personas.map((persona) => (
                              <SelectItem key={persona.id} value={persona.id}>
                                {persona.name} ({persona.provider})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {saving === `${stage.id}-passive` && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Usado quando o contato inicia conversa espontaneamente
                      </p>
                    </div>
                  </div>

                  {config && (config.activePersonaId || config.passivePersonaId) && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      ✅ Configurado - {
                        config.activePersonaId && config.passivePersonaId
                          ? 'Ambos agentes configurados'
                          : config.activePersonaId
                            ? 'Apenas agente ativo configurado'
                            : 'Apenas agente passivo configurado'
                      }
                    </div>
                  )}
                </div>
              );
            })}

            {stages.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum estágio definido para este funil
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
