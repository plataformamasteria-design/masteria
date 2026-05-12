import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { FollowUpStepMessages, FollowUpMessage } from "./FollowUpStepMessages";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Step {
  id: string;
  step_number: number;
  tag_id: string;
  tag_name: string;
  delay_hours: number;
  message: string | null;
  messages?: FollowUpMessage[];
}

interface StepEditorProps {
  sequenceId: string;
  onClose: () => void;
}

const StepEditor = ({ sequenceId, onClose }: StepEditorProps) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState("");
  const [newStepDelay, setNewStepDelay] = useState("");
  const [newStepMessages, setNewStepMessages] = useState<FollowUpMessage[]>([
    { message_order: 1, message_type: 'text', content: '' }
  ]);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSteps();
    }
  }, [sequenceId, currentOrganization?.id]);

  const fetchSteps = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('follow_up_steps')
        .select('*, tags(name)')
        .eq('sequence_id', sequenceId)
        .eq('organization_id', currentOrganization.id)
        .order('step_number');

      if (error) throw error;

      // Buscar mensagens de cada step
      const stepsWithMessages = await Promise.all(
        (data || []).map(async (step: any) => {
          const { data: messagesData } = await (supabase as any)
            .from('follow_up_step_messages')
            .select('*')
            .eq('step_id', step.id)
            .eq('organization_id', currentOrganization.id)
            .order('message_order');

          // Se não tem mensagens na nova tabela, usar a mensagem legada
          let messages: FollowUpMessage[] = [];
          if (messagesData && messagesData.length > 0) {
            messages = messagesData;
          } else if (step.message) {
            messages = [{ message_order: 1, message_type: 'text' as const, content: step.message }];
          }

          return {
            id: step.id,
            step_number: step.step_number,
            tag_id: step.tag_id,
            tag_name: step.tags?.name || '',
            delay_hours: step.delay_hours,
            message: step.message,
            messages,
          };
        })
      );

      setSteps(stepsWithMessages);
    } catch (error) {
      console.error('Error fetching steps:', error);
      toast.error('Erro ao carregar etapas');
    }
  };

  const handleSaveStep = async () => {
    if (!newStepName.trim() || !newStepDelay) {
      toast.error('Preencha o nome e o delay');
      return;
    }

    // Verificar se há pelo menos uma mensagem com conteúdo
    const hasValidMessage = newStepMessages.some(msg => 
      (msg.message_type === 'text' && msg.content?.trim()) ||
      (msg.message_type !== 'text' && msg.file_url)
    );

    if (!hasValidMessage) {
      toast.error('Adicione pelo menos uma mensagem');
      return;
    }

    if (!currentOrganization?.id) {
      toast.error('Organização não identificada');
      return;
    }

    const delayValue = parseInt(newStepDelay);
    if (isNaN(delayValue) || delayValue < 1) {
      toast.error('Delay deve ser um número positivo');
      return;
    }

    try {
      const delayInHours = delayValue / 60;

      // Check for existing tag
      const { data: existingTag } = await (supabase as any)
        .from('tags')
        .select('id')
        .eq('name', newStepName.trim())
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      let tagId: string;
      
      if (existingTag) {
        tagId = existingTag.id;
        toast.info('Usando tag existente: ' + newStepName);
      } else {
        const { data: newTag, error: tagError } = await (supabase as any)
          .from('tags')
          .insert({ 
            name: newStepName.trim(),
            color: '#3B82F6',
            icon: 'Tag',
            organization_id: currentOrganization.id
          })
          .select('id')
          .single();

        if (tagError) throw new Error('Erro ao criar tag: ' + tagError.message);
        tagId = newTag.id;
      }

      // Buscar o próximo step_number do banco para evitar conflitos
      const { data: maxStepData } = await (supabase as any)
        .from('follow_up_steps')
        .select('step_number')
        .eq('sequence_id', sequenceId)
        .order('step_number', { ascending: false })
        .limit(1);
      
      const nextStepNumber = (maxStepData && maxStepData.length > 0) 
        ? maxStepData[0].step_number + 1 
        : 1;
      
      // Criar o step
      const { data: newStep, error: stepError } = await (supabase as any)
        .from('follow_up_steps')
        .insert({
          sequence_id: sequenceId,
          step_number: nextStepNumber,
          tag_id: tagId,
          delay_hours: delayInHours,
          message: null, // Usar a nova tabela de mensagens
          organization_id: currentOrganization.id
        })
        .select()
        .single();

      if (stepError) throw new Error('Erro ao criar etapa: ' + stepError.message);

      // Salvar as mensagens na nova tabela
      const messagesToInsert = newStepMessages
        .filter(msg => (msg.message_type === 'text' && msg.content?.trim()) || (msg.message_type !== 'text' && msg.file_url))
        .map((msg, idx) => ({
          step_id: newStep.id,
          organization_id: currentOrganization.id,
          message_order: idx + 1,
          message_type: msg.message_type,
          content: msg.content || null,
          file_url: msg.file_url || null,
          file_name: msg.file_name || null,
        }));

      if (messagesToInsert.length > 0) {
        const { error: messagesError } = await (supabase as any)
          .from('follow_up_step_messages')
          .insert(messagesToInsert);

        if (messagesError) throw new Error('Erro ao salvar mensagens: ' + messagesError.message);
      }

      toast.success('Etapa adicionada com sucesso');

      // Reset form
      setNewStepName('');
      setNewStepDelay('');
      setNewStepMessages([{ message_order: 1, message_type: 'text', content: '' }]);
      fetchSteps();
    } catch (error: any) {
      console.error('Error saving step:', error);
      toast.error(error.message || 'Erro ao salvar etapa');
    }
  };

  const handleUpdateStepMessages = async (stepId: string, messages: FollowUpMessage[]) => {
    if (!currentOrganization?.id) return;

    try {
      // Deletar mensagens antigas
      await (supabase as any)
        .from('follow_up_step_messages')
        .delete()
        .eq('step_id', stepId)
        .eq('organization_id', currentOrganization.id);

      // Inserir novas mensagens
      const messagesToInsert = messages
        .filter(msg => (msg.message_type === 'text' && msg.content?.trim()) || (msg.message_type !== 'text' && msg.file_url))
        .map((msg, idx) => ({
          step_id: stepId,
          organization_id: currentOrganization.id,
          message_order: idx + 1,
          message_type: msg.message_type,
          content: msg.content || null,
          file_url: msg.file_url || null,
          file_name: msg.file_name || null,
        }));

      if (messagesToInsert.length > 0) {
        const { error } = await (supabase as any)
          .from('follow_up_step_messages')
          .insert(messagesToInsert);

        if (error) throw error;
      }

      toast.success('Mensagens atualizadas');
      fetchSteps();
    } catch (error) {
      console.error('Error updating messages:', error);
      toast.error('Erro ao atualizar mensagens');
    }
  };

  const handleDeleteStep = async (stepId: string, tagId: string) => {
    try {
      // Deletar mensagens primeiro
      await (supabase as any)
        .from('follow_up_step_messages')
        .delete()
        .eq('step_id', stepId);

      // Verificar se a tag está sendo usada em outras etapas
      const { count } = await (supabase as any)
        .from('follow_up_steps')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tagId);

      const isTagUsedElsewhere = count && count > 1;

      // Delete step
      const { error: stepError } = await (supabase as any)
        .from('follow_up_steps')
        .delete()
        .eq('id', stepId);

      if (stepError) throw stepError;

      // Apenas deletar a tag se não estiver sendo usada em outras etapas
      if (!isTagUsedElsewhere) {
        const { count: chatTagCount } = await (supabase as any)
          .from('chat_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tagId);

        if (!chatTagCount || chatTagCount === 0) {
          await (supabase as any)
            .from('tags')
            .delete()
            .eq('id', tagId);
        }
      }

      toast.success('Etapa removida com sucesso');
      fetchSteps();
    } catch (error) {
      console.error('Error deleting step:', error);
      toast.error('Erro ao remover etapa');
    }
  };

  const formatDelay = (delayHours: number) => {
    if (delayHours < 1) {
      return `${Math.round(delayHours * 60)} minutos`;
    } else if (delayHours >= 24) {
      const days = Math.round(delayHours / 24);
      return `${days} dia${days > 1 ? 's' : ''}`;
    } else {
      return `${delayHours}h`;
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Etapas da Sequência</CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Fechar
          </Button>
        </div>
        <CardDescription>
          Configure as etapas de follow-up com múltiplas mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de etapas existentes */}
        <div className="space-y-3">
          {steps.map((step) => (
            <Collapsible 
              key={step.id}
              open={expandedStepId === step.id}
              onOpenChange={(open) => setExpandedStepId(open ? step.id : null)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Etapa {step.step_number}</Badge>
                      <span className="font-medium">{step.tag_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDelay(step.delay_hours)} após último contato
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {step.messages?.length || 0} mensagem(ns)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {expandedStepId === step.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(step.id, step.tag_id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t">
                    <Label className="text-sm font-medium mb-3 block">
                      Mensagens desta etapa
                    </Label>
                    {currentOrganization?.id && (
                      <FollowUpStepMessages
                        messages={step.messages || []}
                        onChange={(messages) => handleUpdateStepMessages(step.id, messages)}
                        organizationId={currentOrganization.id}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {/* Formulário para nova etapa */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Adicionar Nova Etapa</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stepName">Nome da Etapa (Tag)</Label>
                <Input
                  id="stepName"
                  placeholder="Ex: Follow-up 1"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="stepDelay">Delay (minutos)</Label>
                <Input
                  id="stepDelay"
                  type="number"
                  placeholder="Ex: 60 para 1 hora"
                  value={newStepDelay}
                  onChange={(e) => setNewStepDelay(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  60 = 1h | 1440 = 1 dia
                </p>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Mensagens</Label>
              {currentOrganization?.id && (
                <FollowUpStepMessages
                  messages={newStepMessages}
                  onChange={setNewStepMessages}
                  organizationId={currentOrganization.id}
                />
              )}
            </div>

            <Button onClick={handleSaveStep} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Salvar Etapa
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepEditor;
