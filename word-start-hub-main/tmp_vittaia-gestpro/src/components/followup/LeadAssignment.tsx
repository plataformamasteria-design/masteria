import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tag, X } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface LeadAssignmentProps {
  sequenceId: string;
  onClose: () => void;
}

const LeadAssignment = ({ sequenceId, onClose }: LeadAssignmentProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTags();
      fetchSelectedTriggers();
    }
  }, [sequenceId, currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    
    const { data, error } = await (supabase as any)
      .from('tags')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      return;
    }

    setTags(data || []);
  };

  const fetchSelectedTriggers = async () => {
    if (!currentOrganization?.id) return;
    
    const { data, error } = await (supabase as any)
      .from('follow_up_sequence_triggers')
      .select('trigger_tag_id')
      .eq('sequence_id', sequenceId)
      .eq('organization_id', currentOrganization.id);

    if (error) {
      console.error('Error fetching triggers:', error);
      return;
    }

    setSelectedTags(data?.map((t: any) => t.trigger_tag_id) || []);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) {
      console.error('Organization not identified:', currentOrganization);
      toast.error('Organização não identificada');
      return;
    }

    setLoading(true);
    try {
      console.log('Saving triggers for sequence:', sequenceId, 'with organization_id:', currentOrganization.id);
      
      // Delete all existing triggers for this sequence
      const { error: deleteError } = await (supabase as any)
        .from('follow_up_sequence_triggers')
        .delete()
        .eq('sequence_id', sequenceId);

      if (deleteError) {
        console.error('Error deleting existing triggers:', deleteError);
        throw deleteError;
      }

      // Insert new triggers
      if (selectedTags.length > 0) {
        const triggers = selectedTags.map(tagId => ({
          sequence_id: sequenceId,
          trigger_tag_id: tagId,
          organization_id: currentOrganization.id
        }));

        console.log('Inserting triggers:', triggers);

        const { error } = await (supabase as any)
          .from('follow_up_sequence_triggers')
          .insert(triggers);

        if (error) {
          console.error('Trigger insertion error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }

        console.log('Triggers inserted successfully');
      }

      // Backfill existing chats with trigger tags (only if sequence is active)
      if (selectedTags.length > 0) {
        // Verificar se a sequência está ativa
        const { data: sequence } = await (supabase as any)
          .from('follow_up_sequences')
          .select('active')
          .eq('id', sequenceId)
          .single();

        if (sequence?.active) {
          const { data: chatsWithTags } = await (supabase as any)
            .from('chat_tags')
            .select('chat_id, tag_id, organization_id')
            .eq('organization_id', currentOrganization.id)
            .in('tag_id', selectedTags);

          if (chatsWithTags && chatsWithTags.length > 0) {
            toast.info(`Processando ${chatsWithTags.length} leads existentes...`);
            
            let activated = 0;
            // Trigger detector for each chat with trigger tags
            for (const chatTag of chatsWithTags) {
              try {
                const result = await (supabase as any).functions.invoke('follow-up-trigger-detector', {
                  body: { 
                    chat_id: chatTag.chat_id, 
                    tag_id: chatTag.tag_id,
                    organization_id: chatTag.organization_id
                  }
                });
                
                if (result.data?.triggered) {
                  activated++;
                }
              } catch (error) {
                console.error('Error triggering follow-up for existing chat:', error);
              }
            }
            
            if (activated > 0) {
              toast.success(`${activated} leads ativados no follow-up!`);
            }
          }
        } else {
          toast.info('Etiquetas configuradas. Ative a sequência para iniciar o follow-up.');
        }
      }

      toast.success('Etiquetas de ativação configuradas!');
      onClose();
    } catch (error: any) {
      console.error('Error saving triggers:', error);
      toast.error(`Erro ao salvar etiquetas de ativação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            <CardTitle>Atribuir Leads por Etiquetas</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Selecione as etiquetas que devem ativar automaticamente esta sequência.
          Leads com essas etiquetas serão processados automaticamente a cada minuto.
          Ao salvar, leads existentes com essas etiquetas também serão incluídos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center space-x-2">
              <Checkbox
                id={tag.id}
                checked={selectedTags.includes(tag.id)}
                onCheckedChange={() => handleToggleTag(tag.id)}
              />
              <Label
                htmlFor={tag.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadAssignment;
