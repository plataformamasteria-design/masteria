import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { 
  Plus, Settings2, Power, PowerOff, Edit2, Trash2, Tag, 
  MoreVertical, Search, Repeat, MessageSquare, Clock, Layers
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StepEditor from "./StepEditor";
import LeadAssignment from "./LeadAssignment";
import { toast } from "sonner";

interface Sequence {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  triggerTags?: { id: string; name: string; color: string }[];
  stepsCount?: number;
  leadsCount?: number;
}

interface SequenceManagerProps {
  onUpdate?: () => void;
}

const SequenceManager = ({ onUpdate }: SequenceManagerProps) => {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [editingSequence, setEditingSequence] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
  const [deletingSequence, setDeletingSequence] = useState<string | null>(null);
  const [assigningLeads, setAssigningLeads] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSequences();
    }
  }, [currentOrganization?.id]);

  const fetchSequences = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('follow_up_sequences')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar dados adicionais para cada sequência
      const sequencesWithData = await Promise.all(
        (data || []).map(async (seq: any) => {
          // Tags de trigger
          const { data: triggers } = await (supabase as any)
            .from('follow_up_sequence_triggers')
            .select('trigger_tag_id, tags(id, name, color)')
            .eq('sequence_id', seq.id)
            .eq('organization_id', currentOrganization.id);
          
          // Contagem de etapas
          const { count: stepsCount } = await (supabase as any)
            .from('follow_up_steps')
            .select('*', { count: 'exact', head: true })
            .eq('sequence_id', seq.id);
          
          // Contagem de leads ativos
          const { count: leadsCount } = await (supabase as any)
            .from('lead_follow_up_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('sequence_id', seq.id)
            .eq('completed', false);
          
          return {
            ...seq,
            triggerTags: triggers?.map((t: any) => t.tags).filter(Boolean) || [],
            stepsCount: stepsCount || 0,
            leadsCount: leadsCount || 0
          };
        })
      );
      
      setSequences(sequencesWithData);
    } catch (error) {
      console.error('Error fetching sequences:', error);
      toast.error('Erro ao carregar sequências');
    }
  };

  const handleCreateSequence = async () => {
    if (!currentOrganization?.id) {
      toast.error('Organização não identificada');
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('follow_up_sequences')
        .insert({ 
          name: 'Nova Sequência', 
          active: false,
          organization_id: currentOrganization.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Sequência criada! Configure as etapas e etiquetas de ativação.');
      setEditingSequence(data.id);
      fetchSequences();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error creating sequence:', error);
      toast.error(`Erro ao criar sequência: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    if (!currentOrganization?.id) return;
    
    // Verificações apenas ao ativar
    if (!currentState) {
      // Verificar se há etapas configuradas
      const { count } = await (supabase as any)
        .from('follow_up_steps')
        .select('*', { count: 'exact', head: true })
        .eq('sequence_id', id)
        .eq('organization_id', currentOrganization.id);

      if (!count || count === 0) {
        toast.error('Configure pelo menos uma etapa antes de ativar a sequência');
        return;
      }

      // Verificar se há tags de trigger
      const { data: triggers } = await (supabase as any)
        .from('follow_up_sequence_triggers')
        .select('id')
        .eq('sequence_id', id)
        .eq('organization_id', currentOrganization.id);

      if (!triggers || triggers.length === 0) {
        toast.error('Atribua pelo menos uma etiqueta de ativação antes de ativar a sequência');
        return;
      }
    }

    try {
      const { error } = await (supabase as any)
        .from('follow_up_sequences')
        .update({ active: !currentState })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentState ? 'Sequência desativada' : 'Sequência ativada');
      fetchSequences();
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling sequence:', error);
      toast.error('Erro ao atualizar sequência');
    }
  };

  const handleUpdateName = async (id: string, newName: string) => {
    try {
      const { error } = await (supabase as any)
        .from('follow_up_sequences')
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;

      toast.success('Nome atualizado com sucesso');
      setEditingName(null);
      fetchSequences();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating sequence name:', error);
      toast.error('Erro ao atualizar nome');
    }
  };

  const handleDeleteSequence = async (id: string) => {
    try {
      // Deletar trackings associados
      await (supabase as any)
        .from('lead_follow_up_tracking')
        .delete()
        .eq('sequence_id', id);

      // Deletar triggers da sequência
      await (supabase as any)
        .from('follow_up_sequence_triggers')
        .delete()
        .eq('sequence_id', id);

      // Deletar mensagens dos steps
      const { data: steps } = await (supabase as any)
        .from('follow_up_steps')
        .select('id')
        .eq('sequence_id', id);

      if (steps && steps.length > 0) {
        const stepIds = steps.map((s: any) => s.id);
        await (supabase as any)
          .from('follow_up_step_messages')
          .delete()
          .in('step_id', stepIds);
      }

      // Deletar todos os steps da sequência
      await (supabase as any)
        .from('follow_up_steps')
        .delete()
        .eq('sequence_id', id);

      // Deletar a sequência
      const { error: sequenceError } = await (supabase as any)
        .from('follow_up_sequences')
        .delete()
        .eq('id', id);

      if (sequenceError) throw sequenceError;

      toast.success('Sequência excluída com sucesso');
      setDeletingSequence(null);
      fetchSequences();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting sequence:', error);
      toast.error('Erro ao excluir sequência');
    }
  };

  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar sequências..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreateSequence} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova Sequência
        </Button>
      </div>

      {/* Sequences Grid */}
      {filteredSequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {search ? 'Nenhuma sequência encontrada' : 'Nenhuma sequência criada'}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              {search
                ? 'Tente buscar por outro termo'
                : 'Crie sua primeira sequência de follow-up para engajar leads automaticamente'}
            </p>
            {!search && (
              <Button onClick={handleCreateSequence} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar Sequência
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSequences.map((seq) => (
            <div key={seq.id}>
              <Card 
                className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  !seq.active 
                    ? 'opacity-70 border-dashed' 
                    : 'hover:border-primary/50'
                }`}
              >
                <CardContent className="p-0">
                  {/* Header com ícone e menu */}
                  <div className="flex items-center justify-between p-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${seq.active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Repeat className={`h-5 w-5 ${seq.active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingName({ id: seq.id, name: seq.name })}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingSequence(seq.id)}>
                          <Settings2 className="h-4 w-4 mr-2" />
                          Configurar Etapas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAssigningLeads(seq.id)}>
                          <Tag className="h-4 w-4 mr-2" />
                          Etiquetas de Ativação
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(seq.id, seq.active)}>
                          {seq.active ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingSequence(seq.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Conteúdo */}
                  <div className="px-4 pb-3">
                    {editingName?.id === seq.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editingName.name}
                          onChange={(e) => setEditingName({ id: seq.id, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateName(seq.id, editingName.name);
                            } else if (e.key === 'Escape') {
                              setEditingName(null);
                            }
                          }}
                          autoFocus
                          className="h-8"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => handleUpdateName(seq.id, editingName.name)}
                        >
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-foreground mb-2">{seq.name}</h3>
                        {seq.triggerTags && seq.triggerTags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {seq.triggerTags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs"
                                style={{ 
                                  backgroundColor: `${tag.color}15`,
                                  borderColor: `${tag.color}40`,
                                  color: tag.color
                                }}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                            {seq.triggerTags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{seq.triggerTags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        {(!seq.triggerTags || seq.triggerTags.length === 0) && (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma etiqueta configurada
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer com métricas */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        <span>{seq.stepsCount || 0} {(seq.stepsCount || 0) === 1 ? 'etapa' : 'etapas'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{seq.leadsCount || 0} leads</span>
                      </div>
                    </div>
                    <Badge 
                      variant={seq.active ? 'default' : 'secondary'} 
                      className={`text-xs ${seq.active ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' : ''}`}
                    >
                      {seq.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Step Editor Dialog */}
              {editingSequence === seq.id && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <StepEditor
                      sequenceId={seq.id}
                      onClose={() => {
                        setEditingSequence(null);
                        fetchSequences();
                        onUpdate?.();
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Lead Assignment Dialog */}
              {assigningLeads === seq.id && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto">
                    <LeadAssignment
                      sequenceId={seq.id}
                      onClose={() => {
                        setAssigningLeads(null);
                        fetchSequences();
                        onUpdate?.();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSequence} onOpenChange={() => setDeletingSequence(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sequência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta sequência? Todas as etapas configuradas e histórico de leads serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSequence && handleDeleteSequence(deletingSequence)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SequenceManager;
