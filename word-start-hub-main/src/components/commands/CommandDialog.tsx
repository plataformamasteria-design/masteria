import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { CommandStepEditor } from './CommandStepEditor';

interface CommandStep {
  id?: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

interface SlashCommand {
  id: string;
  name: string;
  shortcut: string;
  description: string | null;
  active: boolean;
  delay_seconds?: number;
}

interface CommandDialogProps {
  open: boolean;
  onClose: () => void;
  command: SlashCommand | null;
  onSaved: () => void;
}

export function CommandDialog({ open, onClose, command, onSaved }: CommandDialogProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [description, setDescription] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [steps, setSteps] = useState<CommandStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (command) {
        setName(command.name);
        setShortcut(command.shortcut);
        setDescription(command.description || '');
        setDelaySeconds(command.delay_seconds ?? 5);
        fetchSteps(command.id);
      } else {
        setName('');
        setShortcut('');
        setDescription('');
        setDelaySeconds(5);
        setSteps([{ step_order: 1, message_type: 'text', content: '' }]);
      }
    }
  }, [open, command]);

  const fetchSteps = async (commandId: string) => {
    setLoadingSteps(true);
    try {
      const { data, error } = await supabase
        .from('slash_command_steps')
        .select('*')
        .eq('command_id', commandId)
        .order('step_order');

      if (error) throw error;

      if (data && data.length > 0) {
        setSteps(data.map(step => ({
          id: step.id,
          step_order: step.step_order,
          message_type: step.message_type as 'text' | 'audio' | 'image' | 'pdf' | 'video',
          content: step.content || undefined,
          file_url: step.file_url || undefined,
          file_name: step.file_name || undefined,
        })));
      } else {
        setSteps([{ step_order: 1, message_type: 'text', content: '' }]);
      }
    } catch (error) {
      console.error('Error fetching steps:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as etapas do comando',
        variant: 'destructive',
      });
    } finally {
      setLoadingSteps(false);
    }
  };

  const normalizeShortcut = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30);
  };

  const handleSave = async () => {
    if (!currentOrganization?.id || !user?.id) return;
    if (!name.trim() || !shortcut.trim()) {
      toast({
        title: 'Erro',
        description: 'Preencha o nome e o atalho do comando',
        variant: 'destructive',
      });
      return;
    }

    // Validate steps
    const validSteps = steps.filter(step => {
      if (step.message_type === 'text') {
        return step.content?.trim();
      }
      return step.file_url;
    });

    if (validSteps.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos uma mensagem ao comando',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let commandId = command?.id;

      if (command) {
        // Update existing command
        const { error } = await supabase
          .from('slash_commands')
          .update({
            name: name.trim(),
            shortcut: normalizeShortcut(shortcut),
            description: description.trim() || null,
            delay_seconds: delaySeconds,
          })
          .eq('id', command.id);

        if (error) throw error;

        // Delete old steps
        await supabase
          .from('slash_command_steps')
          .delete()
          .eq('command_id', command.id);
      } else {
        // Create new command
        const { data, error } = await supabase
          .from('slash_commands')
          .insert({
            organization_id: currentOrganization.id,
            name: name.trim(),
            shortcut: normalizeShortcut(shortcut),
            description: description.trim() || null,
            delay_seconds: delaySeconds,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        commandId = data.id;
      }

      // Insert steps
      if (commandId) {
        const stepsToInsert = validSteps.map((step, index) => ({
          command_id: commandId,
          organization_id: currentOrganization.id,
          step_order: index + 1,
          message_type: step.message_type,
          content: step.message_type === 'text' ? step.content : null,
          file_url: step.message_type !== 'text' ? step.file_url : null,
          file_name: step.message_type !== 'text' ? step.file_name : null,
        }));

        const { error: stepsError } = await supabase
          .from('slash_command_steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      toast({
        title: command ? 'Comando atualizado' : 'Comando criado',
        description: `O comando /${normalizeShortcut(shortcut)} foi ${command ? 'atualizado' : 'criado'} com sucesso`,
      });

      onSaved();
    } catch (error: any) {
      console.error('Error saving command:', error);
      
      if (error.code === '23505') {
        toast({
          title: 'Erro',
          description: 'Já existe um comando com este atalho',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível salvar o comando',
          variant: 'destructive',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {command ? 'Editar Comando' : 'Novo Comando'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Command Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Comando</Label>
              <Input
                id="name"
                placeholder="Ex: Localização"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortcut">Atalho (sem a barra)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                <Input
                  id="shortcut"
                  placeholder="localizacao"
                  value={shortcut}
                  onChange={(e) => setShortcut(normalizeShortcut(e.target.value))}
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descrição interna para organização"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Steps Editor */}
          <div className="space-y-2">
            <Label>Sequência de Mensagens</Label>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Intervalo entre mensagens:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Math.min(60, Math.max(1, parseInt(e.target.value) || 5)))}
                  className="w-20 h-8"
                />
                <span>segundos</span>
              </div>
            </div>
            
            {loadingSteps ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandStepEditor
                steps={steps}
                onChange={setSteps}
                organizationId={currentOrganization?.id || ''}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {command ? 'Salvar Alterações' : 'Criar Comando'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
