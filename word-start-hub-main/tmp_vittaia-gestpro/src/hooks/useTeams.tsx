import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Team, TeamMember, Profile } from '@/types/database-helpers';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';

interface TeamWithMembers extends Team {
  members?: (TeamMember & { profile: Profile })[];
}

export function useTeams() {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (!currentOrganization?.id) return;

    fetchTeams();

    // Realtime subscriptions
    const teamsChannel = supabase
      .channel('teams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        fetchTeams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(teamsChannel);
    };
  }, [currentOrganization?.id]);

  const fetchTeams = async () => {
    try {
      let query = supabase.from('teams').select('*');

      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      const { data: teamsData, error: teamsError } = await query.order('name');

      if (teamsError) throw teamsError;

      // Fetch members for each team
      const teamsWithMembers = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: membersData } = await supabase
            .from('team_members')
            .select(`
              *,
              profile:profiles(*)
            `)
            .eq('team_id', team.id);

          return {
            ...team,
            members: (membersData || []).filter((m: any) => m.profile != null)
          };
        })
      );

      setTeams(teamsWithMembers);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Erro ao carregar equipes');
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (name: string, description?: string, color?: string) => {
    if (!currentOrganization?.id) return;

    try {
      const { error } = await supabase
        .from('teams')
        .insert({
          name,
          description,
          color: color || '#10b981',
          organization_id: currentOrganization.id
        });

      if (error) throw error;

      toast.success('Equipe criada com sucesso');
      fetchTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('Erro ao criar equipe');
    }
  };

  const updateTeam = async (id: string, name: string, description?: string, active?: boolean, color?: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ name, description, active, color })
        .eq('id', id);

      if (error) throw error;

      toast.success('Equipe atualizada com sucesso');
      fetchTeams();
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error('Erro ao atualizar equipe');
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Equipe excluída com sucesso');
      fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Erro ao excluir equipe');
    }
  };

  const addMember = async (teamId: string, userId: string) => {
    if (!currentOrganization?.id) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId,
          organization_id: currentOrganization.id
        });

      if (error) throw error;

      toast.success('Membro adicionado com sucesso');
      fetchTeams();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Erro ao adicionar membro');
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Membro removido com sucesso');
      fetchTeams();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover membro');
    }
  };

  return {
    teams,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    refreshTeams: fetchTeams
  };
}
