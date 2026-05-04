import { BehaviorSettings } from '@/components/ia/behavior-settings';
import { SalesSettings } from '@/components/ia/sales-settings';
import { ExternalSourcesManager } from '@/components/ia/external-sources-manager';
import type { Persona as Agent } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@/contexts/analytics-context';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, LineChart, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AGENT_TYPE_CONFIG, type AgentType } from '@/lib/agent-categories';

export function PersonaEditor({
  persona: initialAgent,
  onSaveSuccess: onSaveSuccessCallback
}: {
  persona: Agent | null;
  onSaveSuccess?: (agent?: Agent) => void;
}) {
  const router = useRouter();
  const { trackEvent } = useAnalytics();

  // Estado local para gerir os dados do agente.
  const [agent, setAgent] = useState<Agent | null>(initialAgent);

  // Estado do tipo de agente (separado para poder mudar antes de salvar)
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(
    (initialAgent?.agentType as AgentType) || 'GENERAL'
  );

  // Efeito para sincronizar o estado se a prop inicial mudar.
  useEffect(() => {
    setAgent(initialAgent);
    setSelectedAgentType((initialAgent?.agentType as AgentType) || 'GENERAL');
  }, [initialAgent]);

  // Config do tipo selecionado
  const typeConfig = useMemo(
    () => AGENT_TYPE_CONFIG[selectedAgentType] || AGENT_TYPE_CONFIG.GENERAL,
    [selectedAgentType]
  );

  // Conta quantas tabs são visíveis para definir grid-cols
  const visibleTabCount = useMemo(() => {
    return [typeConfig.tabs.behavior, typeConfig.tabs.sales, typeConfig.tabs.resources]
      .filter(Boolean).length;
  }, [typeConfig]);

  const handleAgentTypeChange = (newType: AgentType) => {
    setSelectedAgentType(newType);
    // Atualiza o agent local para que o BehaviorSettings envie o tipo correto na próxima save
    if (agent) {
      setAgent({ ...agent, agentType: newType });
    }
  };

  const handleSaveSuccess = (savedAgent: Agent) => {
    const isCreating = !agent?.id;

    // Atualiza o estado local com os dados salvos.
    setAgent(savedAgent);
    setSelectedAgentType((savedAgent.agentType as AgentType) || 'GENERAL');

    if (isCreating) {
      trackEvent('agent_created', { agentId: savedAgent.id, agentName: savedAgent.name });
      // Redireciona para a página de edição para que a URL reflita o ID do novo agente.
      router.push(`/agentes-ia/${savedAgent.id}`);
    } else {
      trackEvent('agent_updated', { agentId: savedAgent.id, agentName: savedAgent.name });
      // Chama callback externo para atualizar página principal
      onSaveSuccessCallback?.(savedAgent);
    }
  };

  // Determina a tab inicial mais adequada
  const defaultTab = typeConfig.tabs.behavior ? 'behavior' :
    typeConfig.tabs.sales ? 'sales' : 'resources';

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo do Agente */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">Tipo do Agente</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Defina a função principal deste agente. Isso ajusta as configurações disponíveis.
            </p>
            <Select
              value={selectedAgentType}
              onValueChange={(val) => handleAgentTypeChange(val as AgentType)}
            >
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AGENT_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">{config.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full mb-6`} style={{ gridTemplateColumns: `repeat(${visibleTabCount}, 1fr)` }}>
          {typeConfig.tabs.behavior && (
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Comportamento & IA
            </TabsTrigger>
          )}
          {typeConfig.tabs.sales && (
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Vendas & Conversão
            </TabsTrigger>
          )}
          {typeConfig.tabs.resources && (
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Recursos & RAG
            </TabsTrigger>
          )}
        </TabsList>

        {typeConfig.tabs.behavior && (
          <TabsContent value="behavior">
            <BehaviorSettings persona={agent} onSaveSuccess={handleSaveSuccess} />
          </TabsContent>
        )}

        {typeConfig.tabs.sales && (
          <TabsContent value="sales">
            <SalesSettings persona={agent} onSaveSuccess={handleSaveSuccess} />
          </TabsContent>
        )}

        {typeConfig.tabs.resources && (
          <TabsContent value="resources">
            <ExternalSourcesManager personaId={agent?.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
