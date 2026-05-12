import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Profile, Team } from '@/types/database-helpers';
import { toast } from 'sonner';

export type ResolutionOutcome = 'client' | 'not_client' | 'postponed';

interface UseChatAssignmentOptions {
  organizationId?: string;
}

export function useChatAssignment(options?: UseChatAssignmentOptions) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [options?.organizationId]);

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // If organizationId is provided, filter by it
      if (options?.organizationId) {
        // Fetch users that belong to this organization via team_members or profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*, team_members(team_id)')
          .eq('organization_id', options.organizationId)
          .order('full_name');

        if (profilesError) throw profilesError;

        // Fetch teams from this organization
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('active', true)
          .eq('organization_id', options.organizationId)
          .order('name');

        if (teamsError) throw teamsError;

        setUsers(profilesData || []);
        setTeams(teamsData || []);
      } else {
        // Fallback to fetching all (for backwards compatibility)
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*, team_members(team_id)')
          .order('full_name');

        if (usersError) throw usersError;

        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('active', true)
          .order('name');

        if (teamsError) throw teamsError;

        setUsers(usersData || []);
        setTeams(teamsData || []);
      }
    } catch (error) {
      console.error('Error fetching assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignToUser = async (chatId: string, userId: string, isTransfer?: boolean) => {
    try {
      // Buscar o chat atual para verificar se é transferência
      const { data: currentChat } = await supabase
        .from('chats')
        .select('assigned_to, organization_id')
        .eq('id', chatId)
        .single();

      // Detectar transferência automaticamente se não foi especificado
      const isActualTransfer = isTransfer ?? (currentChat?.assigned_to && currentChat.assigned_to !== userId && userId !== currentUserId);

      const updateData: any = {
        assigned_to: userId,
        agent_off: true,
        assigned_at: new Date().toISOString(),
        human_requested_at: null,
        bot_finished_at: null
      };

      // Se for transferência para outro usuário, marcar transfer_requested_at
      if (isActualTransfer) {
        updateData.transfer_requested_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chatId);

      if (error) throw error;

      // Buscar nomes dos usuários
      const { data: assignedUser } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      const assignerName = users.find(u => u.id === currentUserId)?.full_name || 'Sistema';
      const assignedName = assignedUser?.full_name || 'Usuário';

      // Inserir mensagem de sistema
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: isActualTransfer
            ? `🔄 ${assignerName} transferiu a conversa para ${assignedName}`
            : `${assignerName} atribuiu a conversa a ${assignedName}`,
          message_type: 'system',
          is_from_user: false,
          private: false,
          sent_by: currentUserId,
          organization_id: currentChat?.organization_id
        });

      toast.success(isActualTransfer ? 'Chat transferido com sucesso' : 'Chat atribuído com sucesso');
    } catch (error) {
      console.error('Error assigning chat to user:', error);
      toast.error('Erro ao atribuir chat');
    }
  };

  const assignToTeam = async (chatId: string, teamId: string, isTransfer?: boolean) => {
    try {
      // Buscar o chat atual
      const { data: currentChat } = await supabase
        .from('chats')
        .select('team_id, organization_id')
        .eq('id', chatId)
        .single();

      // Detectar transferência automaticamente
      const isActualTransfer = isTransfer ?? (currentChat?.team_id && currentChat.team_id !== teamId);

      const updateData: any = {
        team_id: teamId,
        assigned_at: new Date().toISOString(),
        human_requested_at: null,
        bot_finished_at: null
      };

      if (isActualTransfer) {
        updateData.transfer_requested_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chatId);

      if (error) throw error;

      // Buscar nome da equipe
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      const assignerName = users.find(u => u.id === currentUserId)?.full_name || 'Sistema';
      const teamName = team?.name || 'Equipe';

      // Inserir mensagem de sistema
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: isActualTransfer
            ? `🔄 ${assignerName} transferiu a conversa para a equipe ${teamName}`
            : `${assignerName} atribuiu a conversa à equipe ${teamName}`,
          message_type: 'system',
          is_from_user: false,
          private: false,
          sent_by: currentUserId,
          organization_id: currentChat?.organization_id
        });

      toast.success(isActualTransfer ? 'Chat transferido para equipe' : 'Chat atribuído à equipe com sucesso');
    } catch (error) {
      console.error('Error assigning chat to team:', error);
      toast.error('Erro ao atribuir chat à equipe');
    }
  };

  const unassign = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          assigned_to: null,
          team_id: null,
          assigned_at: null,
          agent_off: false,
          transfer_requested_at: null
        })
        .eq('id', chatId);

      if (error) throw error;

      const assignerName = users.find(u => u.id === currentUserId)?.full_name || 'Sistema';

      // Buscar organization_id do chat
      const { data: chatData } = await supabase
        .from('chats')
        .select('organization_id')
        .eq('id', chatId)
        .single();

      // Inserir mensagem de sistema
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: `${assignerName} removeu a atribuição da conversa`,
          message_type: 'system',
          is_from_user: false,
          private: false,
          sent_by: currentUserId,
          organization_id: chatData?.organization_id
        });

      toast.success('Atribuição removida com sucesso');
    } catch (error) {
      console.error('Error unassigning chat:', error);
      toast.error('Erro ao remover atribuição');
    }
  };

  const assignToMe = async (chatId: string) => {
    if (!currentUserId) {
      toast.error('Usuário não identificado');
      return;
    }

    // Atribuir usuário (já desativa bot automaticamente) - não é transferência pois é para si mesmo
    // OBS: não atribuir equipe automaticamente (nova regra para evitar "fila enorme" em Equipe)
    await assignToUser(chatId, currentUserId, false);
  };

  const resolveChat = async (
    chatId: string,
    outcome: ResolutionOutcome = 'client',
    notes?: string,
    lossReason?: string
  ) => {
    try {
      // Buscar organization_id do chat primeiro
      const { data: chatData } = await supabase
        .from('chats')
        .select('organization_id')
        .eq('id', chatId)
        .single();

      if (!chatData?.organization_id) {
        throw new Error('Chat não encontrado ou sem organização');
      }

      // Remove atribuições e reativa o bot
      const { error } = await supabase
        .from('chats')
        .update({
          assigned_to: null,
          team_id: null,
          assigned_at: null,
          agent_off: false,
          transfer_requested_at: null,
          human_requested_at: null,
          resolved_at: new Date().toISOString(),
          resolved_by: currentUserId,
          resolution_outcome: outcome,
          ...(outcome === 'not_client' && lossReason ? { loss_reason: lossReason } : {})
        })
        .eq('id', chatId);

      if (error) throw error;

      // Registrar na tabela de resoluções para histórico e métricas
      const { error: resolutionError } = await supabase
        .from('chat_resolutions')
        .insert({
          chat_id: chatId,
          resolved_by: currentUserId,
          outcome,
          notes,
          organization_id: chatData.organization_id
        });

      if (resolutionError) {
        console.error('Error inserting resolution:', resolutionError);
        // Não falha a operação principal se o registro falhar
      }

      const resolverName = users.find(u => u.id === currentUserId)?.full_name || 'Sistema';

      // Mensagem de sistema baseada no desfecho
      const outcomeLabels = {
        client: '🎉 Cliente ganho',
        not_client: '❌ Não converteu',
        postponed: '⏳ Decisão adiada'
      };

      // Inserir mensagem de sistema
      await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: `✅ ${resolverName} finalizou o atendimento (${outcomeLabels[outcome]})`,
          message_type: 'system',
          is_from_user: false,
          private: false,
          sent_by: currentUserId,
          organization_id: chatData.organization_id
        });

      // Se for cliente ganho, tentar adicionar tag "cliente" automaticamente
      if (outcome === 'client') {
        const { data: clienteTag } = await supabase
          .from('tags')
          .select('id')
          .eq('organization_id', chatData.organization_id)
          .ilike('name', '%cliente%')
          .limit(1)
          .maybeSingle();

        if (clienteTag) {
          // Verificar se já tem a tag
          const { data: existingTag } = await supabase
            .from('chat_tags')
            .select('id')
            .eq('chat_id', chatId)
            .eq('tag_id', clienteTag.id)
            .maybeSingle();

          if (!existingTag) {
            await supabase
              .from('chat_tags')
              .insert({
                chat_id: chatId,
                tag_id: clienteTag.id,
                organization_id: chatData.organization_id
              });
          }
        }

        // Disparar Conversão Meta CAPI (De forma silenciosa)
        try {
          supabase.functions.invoke('meta-capi-events', {
            body: {
              organization_id: chatData.organization_id,
              chat_id: chatId,
              event_name: 'Lead',
              value: 0,
              currency: 'BRL'
            }
          }).catch(e => console.error('[Meta CAPI] Async invocation error:', e));
        } catch (e) {
          console.error('[Meta CAPI] Invocation setup error:', e);
        }
      }

      toast.success('Atendimento finalizado com sucesso');
    } catch (error) {
      console.error('Error resolving chat:', error);
      toast.error('Erro ao finalizar atendimento');
    }
  };

  return {
    users,
    teams,
    currentUserId,
    loading,
    assignToUser,
    assignToTeam,
    assignToMe,
    unassign,
    resolveChat,
    refreshData: fetchData
  };
}
