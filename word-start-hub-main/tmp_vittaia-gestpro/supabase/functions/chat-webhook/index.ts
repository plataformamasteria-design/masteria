import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatData {
  phone: string;
  wa_name?: string;
  wa_photo_url?: string;
  last_message?: string;
  agent_off?: boolean;
  // Group fields
  is_group?: boolean;
  group_name?: string;
  group_description?: string;
  group_photo_url?: string;
  participant_count?: number;
  // Human assistance request
  request_human?: boolean;
  // Custom name fields
  custom_name?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract organization_id from URL query parameter
  const url = new URL(req.url);
  const organizationId = url.searchParams.get('organization_id');

  if (!organizationId) {
    console.error('[chat-webhook] organization_id is required in URL');
    return new Response(
      JSON.stringify({ error: 'organization_id é obrigatório na URL como query parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[chat-webhook] Processing request for organization:', organizationId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const method = req.method;
    console.log(`[chat-webhook] ${method} request received`);

    // GET - Listar chats desta organização
    if (method === 'GET') {
      const phone = url.searchParams.get('phone');
      const isGroup = url.searchParams.get('is_group');

      let query = supabase
        .from('chats')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });

      if (phone) {
        query = query.eq('phone', phone);
        console.log(`[chat-webhook] Filtering by phone: ${phone}`);
      }

      // Filter by is_group if provided
      if (isGroup !== null) {
        const isGroupBool = isGroup === 'true';
        query = query.eq('is_group', isGroupBool);
        console.log(`[chat-webhook] Filtering by is_group: ${isGroupBool}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[chat-webhook] Error fetching chats:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar status global do robô desta organização
      const { data: botSettings } = await supabase
        .from('bot_settings')
        .select('global_bot_enabled')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      const globalBotEnabled = botSettings?.global_bot_enabled ?? true;
      console.log(`[chat-webhook] Global bot status: ${globalBotEnabled}`);

      console.log(`[chat-webhook] Found ${data?.length || 0} chats`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data,
          global_bot_enabled: globalBotEnabled
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Criar ou atualizar chat (com agent_off)
    if (method === 'POST') {
      const body: ChatData = await req.json();
      
      if (!body.phone) {
        console.error('[chat-webhook] Missing required field: phone');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "phone" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Upserting chat for phone: ${body.phone}`);

      // Verificar se é um chat novo nesta organização
      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('phone', body.phone)
        .eq('organization_id', organizationId)
        .maybeSingle();

      const isNewChat = !existingChat;

      const { data, error } = await supabase
        .from('chats')
        .upsert(
          {
            phone: body.phone,
            wa_name: body.wa_name || null,
            wa_photo_url: body.wa_photo_url || null,
            last_message: body.last_message || null,
            agent_off: body.agent_off ?? false,
            organization_id: organizationId,
            updated_at: new Date().toISOString(),
            // Group fields
            is_group: body.is_group ?? false,
            group_name: body.group_name || null,
            group_description: body.group_description || null,
            group_photo_url: body.group_photo_url || null,
            participant_count: body.participant_count || 0,
          },
          { onConflict: 'phone,organization_id' }
        )
        .select()
        .single();

      if (error) {
        console.error('[chat-webhook] Error upserting chat:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Chat upserted successfully: ${data.id}`);

      // Se for um novo lead, adicionar tag "Lead Frio" automaticamente
      if (isNewChat) {
        console.log('[chat-webhook] New lead detected, adding "Lead Frio" tag');
        
        // Buscar ou criar tag "Lead Frio" desta organização
        let { data: leadFrioTag } = await supabase
          .from('tags')
          .select('id')
          .ilike('name', 'Lead Frio')
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (!leadFrioTag) {
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ 
              name: 'Lead Frio', 
              color: '#60A5FA',
              organization_id: organizationId
            })
            .select('id')
            .single();
          leadFrioTag = newTag;
        }

        if (leadFrioTag) {
          await supabase
            .from('chat_tags')
            .insert({
              chat_id: data.id,
              tag_id: leadFrioTag.id,
              organization_id: organizationId,
            });
          console.log('[chat-webhook] "Lead Frio" tag added successfully');
        }
      }
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Atualizar APENAS dados do chat (SEM agent_off)
    if (method === 'PUT') {
      const body: ChatData = await req.json();

      if (!body.phone) {
        console.error('[chat-webhook] Missing required field: phone');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "phone" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Updating chat data for phone: ${body.phone}`);

      // Check if name is locked before updating wa_name
      const { data: existingChat } = await supabase
        .from('chats')
        .select('name_locked')
        .eq('phone', body.phone)
        .eq('organization_id', organizationId)
        .maybeSingle();

      const updateData: any = { updated_at: new Date().toISOString() };
      
      // Only update wa_name if the name is NOT locked
      if (body.wa_name !== undefined && !existingChat?.name_locked) {
        updateData.wa_name = body.wa_name;
      } else if (body.wa_name !== undefined && existingChat?.name_locked) {
        console.log(`[chat-webhook] Name is locked for ${body.phone}, skipping wa_name update`);
      }
      
      if (body.wa_photo_url !== undefined) updateData.wa_photo_url = body.wa_photo_url;
      if (body.last_message !== undefined) updateData.last_message = body.last_message;
      // Group fields
      if (body.is_group !== undefined) updateData.is_group = body.is_group;
      if (body.group_name !== undefined) updateData.group_name = body.group_name;
      if (body.group_description !== undefined) updateData.group_description = body.group_description;
      if (body.group_photo_url !== undefined) updateData.group_photo_url = body.group_photo_url;
      if (body.participant_count !== undefined) updateData.participant_count = body.participant_count;
      // IMPORTANTE: agent_off NÃO é atualizado neste endpoint

      const { data, error } = await supabase
        .from('chats')
        .update(updateData)
        .eq('phone', body.phone)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        console.error('[chat-webhook] Error updating chat:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Chat data updated successfully: ${data.id}`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PATCH - Atualizar agent_off, request_human OU custom_name
    if (method === 'PATCH') {
      const body: ChatData = await req.json();

      if (!body.phone) {
        console.error('[chat-webhook] Missing required field: phone');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "phone" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle custom_name update - automatically locks the name
      if (body.custom_name !== undefined) {
        console.log(`[chat-webhook] Updating custom_name for phone: ${body.phone} to "${body.custom_name}"`);

        const { data, error } = await supabase
          .from('chats')
          .update({ 
            custom_name: body.custom_name,
            name_locked: true, // Automatically lock when custom name is set
            updated_at: new Date().toISOString()
          })
          .eq('phone', body.phone)
          .eq('organization_id', organizationId)
          .select()
          .single();

        if (error) {
          console.error('[chat-webhook] Error updating custom_name:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[chat-webhook] Custom name set and locked for: ${data.id}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Nome customizado definido e travado',
            data 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle request_human flag
      if (body.request_human !== undefined) {
        console.log(`[chat-webhook] Updating human_requested_at for phone: ${body.phone} to ${body.request_human ? 'NOW()' : 'NULL'}`);

        const { data, error } = await supabase
          .from('chats')
          .update({ 
            human_requested_at: body.request_human ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('phone', body.phone)
          .eq('organization_id', organizationId)
          .select()
          .single();

        if (error) {
          console.error('[chat-webhook] Error updating human_requested_at:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[chat-webhook] Human assistance ${body.request_human ? 'requested' : 'cleared'} for: ${data.id}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: body.request_human ? 'Atendimento humano solicitado' : 'Indicador de atendimento removido',
            data 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.agent_off === undefined) {
        console.error('[chat-webhook] Missing required field: agent_off, request_human or custom_name');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "agent_off", "request_human" ou "custom_name" é obrigatório para PATCH' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Updating agent_off for phone: ${body.phone} to ${body.agent_off}`);

      const { data, error } = await supabase
        .from('chats')
        .update({ 
          agent_off: body.agent_off,
          updated_at: new Date().toISOString()
        })
        .eq('phone', body.phone)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        console.error('[chat-webhook] Error updating agent_off:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Agent status updated successfully: ${data.id}`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover chat
    if (method === 'DELETE') {
      const phone = url.searchParams.get('phone');

      if (!phone) {
        console.error('[chat-webhook] Missing required parameter: phone');
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetro "phone" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Deleting chat for phone: ${phone}`);

      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('phone', phone)
        .eq('organization_id', organizationId);

      if (error) {
        console.error('[chat-webhook] Error deleting chat:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-webhook] Chat deleted successfully`);
      return new Response(
        JSON.stringify({ success: true, message: 'Chat removido com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Método não suportado
    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chat-webhook] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
