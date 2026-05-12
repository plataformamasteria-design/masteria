import React, { useState, useEffect } from 'react';
import { Plus, Zap, Search, MoreVertical, Edit2, Trash2, ToggleLeft, ToggleRight, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { CommandDialog } from '@/components/commands/CommandDialog';
import AppShell from '@/components/AppShell';
import PagePermissionGuard from '@/components/PagePermissionGuard';

interface SlashCommand {
  id: string;
  name: string;
  shortcut: string;
  description: string | null;
  active: boolean;
  created_at: string;
  delay_seconds: number;
  steps_count?: number;
}

export default function Commands() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SlashCommand | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commandToDelete, setCommandToDelete] = useState<SlashCommand | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchCommands();
    }
  }, [currentOrganization?.id]);

  const fetchCommands = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('slash_commands')
        .select(`
          *,
          slash_command_steps(id)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('name');

      if (error) throw error;

      const commandsWithCount = (data || []).map(cmd => ({
        ...cmd,
        steps_count: cmd.slash_command_steps?.length || 0,
        slash_command_steps: undefined
      }));

      setCommands(commandsWithCount);
    } catch (error) {
      console.error('Error fetching commands:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os comandos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (command: SlashCommand) => {
    try {
      const { error } = await supabase
        .from('slash_commands')
        .update({ active: !command.active })
        .eq('id', command.id);

      if (error) throw error;

      setCommands(prev =>
        prev.map(c => c.id === command.id ? { ...c, active: !c.active } : c)
      );

      toast({
        title: command.active ? 'Comando desativado' : 'Comando ativado',
        description: `O comando /${command.shortcut} foi ${command.active ? 'desativado' : 'ativado'}`,
      });
    } catch (error) {
      console.error('Error toggling command:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do comando',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!commandToDelete) return;

    try {
      const { error } = await supabase
        .from('slash_commands')
        .delete()
        .eq('id', commandToDelete.id);

      if (error) throw error;

      setCommands(prev => prev.filter(c => c.id !== commandToDelete.id));
      toast({
        title: 'Comando excluído',
        description: `O comando /${commandToDelete.shortcut} foi excluído`,
      });
    } catch (error) {
      console.error('Error deleting command:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o comando',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCommandToDelete(null);
    }
  };

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    cmd.shortcut.toLowerCase().includes(search.toLowerCase())
  );

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCommand(null);
  };

  const handleCommandSaved = () => {
    fetchCommands();
    handleDialogClose();
  };

  return (
    <AppShell>
      <PagePermissionGuard page="commands">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                Comandos Rápidos
              </h1>
              <p className="text-muted-foreground mt-1">
                Crie sequências de mensagens acionadas por comandos com /
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Comando
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar comandos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Commands List */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCommands.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-1">
                  {search ? 'Nenhum comando encontrado' : 'Nenhum comando criado'}
                </h3>
                <p className="text-muted-foreground text-sm text-center max-w-sm">
                  {search
                    ? 'Tente buscar por outro termo'
                    : 'Crie seu primeiro comando para agilizar respostas no chat'}
                </p>
                {!search && (
                  <Button onClick={() => setDialogOpen(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Comando
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCommands.map(command => (
                <Card 
                  key={command.id} 
                  className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                    !command.active 
                      ? 'opacity-60 border-dashed' 
                      : 'hover:border-primary/50'
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Header com ícone e menu */}
                    <div className="flex items-center justify-between p-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${command.active ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Zap className={`h-5 w-5 ${command.active ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <code className="text-sm font-mono font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
                            /{command.shortcut}
                          </code>
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
                          <DropdownMenuItem onClick={() => {
                            setEditingCommand(command);
                            setDialogOpen(true);
                          }}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(command)}>
                            {command.active ? (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setCommandToDelete(command);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Conteúdo */}
                    <div className="px-4 pb-3">
                      <h3 className="font-semibold text-foreground mb-1">{command.name}</h3>
                      {command.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {command.description}
                        </p>
                      )}
                    </div>

                    {/* Footer com métricas */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{command.steps_count || 0} {(command.steps_count || 0) === 1 ? 'msg' : 'msgs'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{command.delay_seconds || 5}s</span>
                        </div>
                      </div>
                      <Badge 
                        variant={command.active ? 'default' : 'secondary'} 
                        className={`text-xs ${command.active ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' : ''}`}
                      >
                        {command.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Command Dialog */}
          <CommandDialog
            open={dialogOpen}
            onClose={handleDialogClose}
            command={editingCommand}
            onSaved={handleCommandSaved}
          />

          {/* Delete Confirmation */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir comando</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o comando <strong>/{commandToDelete?.shortcut}</strong>?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
}
