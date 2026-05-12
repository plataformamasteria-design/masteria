import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Autorização necessária');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !currentUser) throw new Error('Usuário não autenticado');

    // Verify admin/super_admin/sub_admin role
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .in('role', ['admin', 'super_admin', 'sub_admin']);

    if (!userRoles || userRoles.length === 0) {
      throw new Error('Apenas administradores podem remover usuários');
    }

    const { userId } = await req.json();
    if (!userId) throw new Error('userId é obrigatório');
    if (userId === currentUser.id) throw new Error('Você não pode remover a si mesmo');

    console.log('Removendo usuário:', userId);

    // 1. Nullify chat assignments (keep chat data, remove attribution)
    const { error: chatAssignError } = await supabaseAdmin
      .from('chats')
      .update({ assigned_to: null, assigned_at: null })
      .eq('assigned_to', userId);
    if (chatAssignError) console.error('Erro ao desatribuir chats:', chatAssignError);

    // 2. Nullify resolved_by on chats
    const { error: chatResolvedError } = await supabaseAdmin
      .from('chats')
      .update({ resolved_by: null })
      .eq('resolved_by', userId);
    if (chatResolvedError) console.error('Erro ao desatribuir resolved_by:', chatResolvedError);

    // 3. Nullify chat_assignment_history.assigned_to
    const { error: assignHistError } = await supabaseAdmin
      .from('chat_assignment_history')
      .update({ assigned_to: null })
      .eq('assigned_to', userId);
    if (assignHistError) console.error('Erro ao desatribuir assignment history:', assignHistError);

    // 4. Nullify chat_resolutions.resolved_by
    const { error: resolveError } = await supabaseAdmin
      .from('chat_resolutions')
      .update({ resolved_by: null })
      .eq('resolved_by', userId);
    if (resolveError) console.error('Erro ao desatribuir resolutions:', resolveError);

    // 5. Nullify calendar_events user references
    const { error: calUserError } = await supabaseAdmin
      .from('calendar_events')
      .update({ user_id: null })
      .eq('user_id', userId);
    if (calUserError) console.error('Erro ao desatribuir calendar user_id:', calUserError);

    const { error: calAssignError } = await supabaseAdmin
      .from('calendar_events')
      .update({ assigned_to: null })
      .eq('assigned_to', userId);
    if (calAssignError) console.error('Erro ao desatribuir calendar assigned_to:', calAssignError);

    // 6. Nullify broadcast_campaigns.created_by
    const { error: broadcastError } = await supabaseAdmin
      .from('broadcast_campaigns')
      .update({ created_by: null })
      .eq('created_by', userId);
    if (broadcastError) console.error('Erro ao desatribuir broadcast campaigns:', broadcastError);

    // 7. Nullify automations.created_by
    const { error: autoError } = await supabaseAdmin
      .from('automations')
      .update({ created_by: null })
      .eq('created_by', userId);
    if (autoError) console.error('Erro ao desatribuir automations:', autoError);

    // 8. Nullify chat_tags_history.assigned_by
    const { error: tagHistError } = await supabaseAdmin
      .from('chat_tags_history')
      .update({ assigned_by: null })
      .eq('assigned_by', userId);
    if (tagHistError) console.error('Erro ao desatribuir tag history:', tagHistError);

    // 9. Delete roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (rolesError) console.error('Erro ao deletar roles:', rolesError);

    // 10. Delete permissions
    const { error: permsError } = await supabaseAdmin
      .from('user_page_permissions')
      .delete()
      .eq('user_id', userId);
    if (permsError) console.error('Erro ao deletar permissões:', permsError);

    // 11. Delete team_members entries
    const { error: teamError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('user_id', userId);
    if (teamError) console.error('Erro ao deletar team_members:', teamError);

    // 12. Delete ai_prompts
    const { error: promptsError } = await supabaseAdmin
      .from('ai_prompts')
      .delete()
      .eq('user_id', userId);
    if (promptsError) console.error('Erro ao deletar ai_prompts:', promptsError);

    // 13. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileError) console.error('Erro ao deletar profile:', profileError);

    // 14. Delete from auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Erro ao deletar usuário do auth:', deleteError);
      throw deleteError;
    }

    console.log('Usuário removido com sucesso:', userId);

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário removido com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Erro na edge function delete-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
