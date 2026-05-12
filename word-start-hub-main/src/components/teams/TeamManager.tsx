import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Users, Sparkles, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { TeamCard } from './TeamCard';
import { TeamCardSkeletonGrid } from './TeamCardSkeleton';
import { TeamMemberList } from './TeamMemberList';
import { useTeams } from '@/hooks/useTeams';
import { Team } from '@/types/database-helpers';

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export const TeamManager: React.FC = () => {
  const { teams, loading, createTeam, updateTeam, deleteTeam, addMember, removeMember } = useTeams();
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [managingTeam, setManagingTeam] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  // Auto assignment settings (stored in organizations.settings.auto_assignment)
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [autoAssignTeamId, setAutoAssignTeamId] = useState<string | null>(null);
  const [savingAutoAssign, setSavingAutoAssign] = useState(false);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const latestAutoAssignRef = useRef<{ enabled: boolean; teamId: string | null }>({
    enabled: false,
    teamId: null,
  });
  const isMountedRef = useRef(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#10b981',
    active: true,
  });

  const activeTeams = useMemo(() => teams.filter(t => t.active), [teams]);

  useEffect(() => {
    // Track mounted state to avoid setState after unmount (e.g. when flushing autosave)
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestAutoAssignRef.current = { enabled: autoAssignEnabled, teamId: autoAssignTeamId };
  }, [autoAssignEnabled, autoAssignTeamId]);

  const autoAssignmentSettingsKey = useMemo(() => {
    // Keep the dependency stable-ish and only based on the relevant subtree
    const cfg = (currentOrganization?.settings as any)?.auto_assignment ?? null;
    try {
      return JSON.stringify(cfg);
    } catch {
      return String(cfg);
    }
  }, [currentOrganization?.settings]);

  useEffect(() => {
    const cfg = (currentOrganization?.settings as any)?.auto_assignment;
    if (cfg) {
      setAutoAssignEnabled(!!cfg.enabled);
      setAutoAssignTeamId(cfg.team_id ?? null);
    } else {
      setAutoAssignEnabled(false);
      setAutoAssignTeamId(null);
    }
  }, [currentOrganization?.id, autoAssignmentSettingsKey]);

  const saveAutoAssignment = async (nextEnabled: boolean, nextTeamId: string | null) => {
    if (!currentOrganization?.id) return;
    // Validation: enabled requires a team
    if (nextEnabled && !nextTeamId) return;

    if (isMountedRef.current) setSavingAutoAssign(true);
    try {
      const nextSettings = {
        ...(currentOrganization.settings || {}),
        auto_assignment: {
          enabled: nextEnabled,
          team_id: nextEnabled ? nextTeamId : null,
        },
      };

      const { error } = await supabase
        .from('organizations')
        .update({ settings: nextSettings })
        .eq('id', currentOrganization.id);

      if (error) throw error;

      await refreshOrganizations();
    } catch (e) {
      console.error('Error saving auto assignment settings:', e);
      if (isMountedRef.current) toast.error('Erro ao salvar atribuição automática');
    } finally {
      if (isMountedRef.current) setSavingAutoAssign(false);
    }
  };

  const flushPendingAutoSave = () => {
    if (!autoSaveTimeoutRef.current) return;

    window.clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = null;

    const { enabled, teamId } = latestAutoAssignRef.current;
    if (enabled && !teamId) return;

    // Fire-and-forget: we only need persistence; UI is unmounting.
    void saveAutoAssignment(enabled, teamId);
  };

  // Auto-save (debounced)
  useEffect(() => {
    if (!currentOrganization?.id) return;

    // Cleanup previous timeout
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Validate before scheduling
    if (autoAssignEnabled && !autoAssignTeamId) {
      // No toast spam; just don't save until a team is selected.
      return;
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      saveAutoAssignment(autoAssignEnabled, autoAssignTeamId);
    }, 900);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAssignEnabled, autoAssignTeamId, currentOrganization?.id]);

  // If user navigates away before the debounce window, persist anyway.
  useEffect(() => {
    return () => {
      // Mark unmounted before flushing so we don't try to update local UI state.
      isMountedRef.current = false;
      flushPendingAutoSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    await createTeam(formData.name, formData.description, formData.color);
    setIsCreateOpen(false);
    setFormData({ name: '', description: '', color: '#10b981', active: true });
  };

  const handleUpdate = async () => {
    if (editingTeam) {
      await updateTeam(editingTeam.id, formData.name, formData.description, formData.active, formData.color);
      setEditingTeam(null);
      setFormData({ name: '', description: '', color: '#10b981', active: true });
    }
  };

  const handleDelete = async () => {
    if (deletingTeamId) {
      await deleteTeam(deletingTeamId);
      setDeletingTeamId(null);
    }
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      color: team.color || '#10b981',
      active: team.active,
    });
  };

  const managingTeamData = teams.find((t) => t.id === managingTeam);
  const deletingTeam = teams.find((t) => t.id === deletingTeamId);

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (color: string) => void }) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-8 w-8 rounded-lg transition-all ${value === color ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg border" style={{ backgroundColor: value }} />
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full cursor-pointer"
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <TeamCardSkeletonGrid count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Equipes de Atendimento
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas equipes e organize seus atendentes
              </p>
            </div>
          </div>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
              <Plus className="h-5 w-5" />
              Nova Equipe
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Criar Nova Equipe
              </DialogTitle>
              <DialogDescription>
                Crie uma equipe para organizar seus atendentes de forma eficiente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Equipe</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Suporte, Vendas, Financeiro..."
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o propósito desta equipe (opcional)"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor da Equipe
                </Label>
                <ColorPicker 
                  value={formData.color} 
                  onChange={(color) => setFormData({ ...formData, color })} 
                />
              </div>
              <Button onClick={handleCreate} className="w-full h-11" disabled={!formData.name.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Equipe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Auto assignment */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Atribuição automática</h2>
            <p className="text-sm text-muted-foreground">
              Todo novo lead (e qualquer conversa sem equipe ao receber mensagem do lead) será direcionado para a equipe selecionada.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-assign" className="text-sm">Ativar</Label>
              <Switch
                id="auto-assign"
                checked={autoAssignEnabled}
                onCheckedChange={(checked) => {
                  setAutoAssignEnabled(checked);
                  if (!checked) setAutoAssignTeamId(null);
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-sm">Equipe padrão</Label>
            <Select
              value={autoAssignTeamId || 'none'}
              onValueChange={(v) => setAutoAssignTeamId(v === 'none' ? null : v)}
              disabled={!autoAssignEnabled}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione a equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {activeTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button disabled className="h-10" aria-live="polite">
            {savingAutoAssign ? 'Salvando…' : 'Auto-salvar ativo'}
          </Button>
        </div>
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-6">
            <Users className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhuma equipe criada</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Crie sua primeira equipe para começar a organizar seus atendentes e melhorar seu fluxo de trabalho
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Criar Primeira Equipe
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onManageMembers={() => setManagingTeam(team.id)}
              onEdit={() => openEditDialog(team)}
              onDelete={() => setDeletingTeamId(team.id)}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Equipe</DialogTitle>
            <DialogDescription>
              Atualize as informações da equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da Equipe</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Cor da Equipe
              </Label>
              <ColorPicker 
                value={formData.color} 
                onChange={(color) => setFormData({ ...formData, color })} 
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active">Equipe ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Equipes inativas não aparecem nas atribuições
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
            <Button onClick={handleUpdate} className="w-full h-11">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeamId} onOpenChange={() => setDeletingTeamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe "{deletingTeam?.name}"? 
              Esta ação não pode ser desfeita e todos os membros serão removidos.
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

      {/* Members Management Dialog */}
      <Dialog open={!!managingTeam} onOpenChange={() => setManagingTeam(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Membros - {managingTeamData?.name}
            </DialogTitle>
            <DialogDescription>
              Adicione ou remova membros desta equipe
            </DialogDescription>
          </DialogHeader>
          {managingTeamData && (
            <TeamMemberList
              teamId={managingTeamData.id}
              members={(managingTeamData.members || []).map((m: any) => m.profile)}
              onAddMember={(userId) => addMember(managingTeamData.id, userId)}
              onRemoveMember={(userId) => removeMember(managingTeamData.id, userId)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
