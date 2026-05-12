import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatTagData {
  chat_id?: string;
  tag_id?: string;
  organization_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const method = req.method;
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organization_id');
    
    console.log(`[chat-tags-webhook] ${method} request received, organization_id: ${organizationId}`);

    // GET - Listar tags de um chat ou chats de uma tag
    if (method === 'GET') {
      const chatId = url.searchParams.get('chat_id');
      const tagId = url.searchParams.get('tag_id');

      let query = supabase
        .from('chat_tags')
        .select('*, tags(*), chats(*)');

      if (chatId) {
        query = query.eq('chat_id', chatId);
      }

      if (tagId) {
        query = query.eq('tag_id', tagId);
      }

      // Filtrar por organization_id se fornecido
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[chat-tags-webhook] Error fetching chat tags:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-tags-webhook] Found ${data?.length || 0} chat tags`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Atribuir tag a chat
    if (method === 'POST') {
      const body: ChatTagData = await req.json();

      if (!body.chat_id || !body.tag_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campos "chat_id" e "tag_id" são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Usar organization_id do body ou da URL
      const orgId = body.organization_id || organizationId;
      
      if (!orgId) {
        // Tentar buscar organization_id do chat
        const { data: chatData } = await supabase
          .from('chats')
          .select('organization_id')
          .eq('id', body.chat_id)
          .single();
        
        if (!chatData?.organization_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Campo "organization_id" é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        body.organization_id = chatData.organization_id;
      }

      const finalOrgId = orgId || body.organization_id;

      console.log(`[chat-tags-webhook] Assigning tag ${body.tag_id} to chat ${body.chat_id} for org ${finalOrgId}`);

      // Verificar se a tag já está atribuída ao chat
      const { data: existingTag } = await supabase
        .from('chat_tags')
        .select('id')
        .eq('chat_id', body.chat_id)
        .eq('tag_id', body.tag_id)
        .single();

      if (existingTag) {
        console.log(`[chat-tags-webhook] Tag already assigned to chat`);
        return new Response(
          JSON.stringify({ success: true, data: existingTag, message: 'Tag já atribuída ao chat' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('chat_tags')
        .insert({
          chat_id: body.chat_id,
          tag_id: body.tag_id,
          organization_id: finalOrgId,
        })
        .select()
        .single();

      if (error) {
        console.error('[chat-tags-webhook] Error assigning tag:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-tags-webhook] Tag assigned successfully`);

      // Check if this tag triggers any follow-up sequence
      try {
        const triggerResponse = await fetch(
          `${supabaseUrl}/functions/v1/follow-up-trigger-detector`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              chat_id: body.chat_id,
              tag_id: body.tag_id,
              organization_id: finalOrgId,
            }),
          }
        );

        const triggerResult = await triggerResponse.json();
        console.log('[chat-tags-webhook] Trigger detector result:', triggerResult);
      } catch (triggerError) {
        console.error('[chat-tags-webhook] Error calling trigger detector:', triggerError);
        // Don't fail the main request if trigger detection fails
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover tag de chat
    if (method === 'DELETE') {
      const chatId = url.searchParams.get('chat_id');
      const tagId = url.searchParams.get('tag_id');

      if (!chatId || !tagId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetros "chat_id" e "tag_id" são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-tags-webhook] Removing tag ${tagId} from chat ${chatId}`);

      let query = supabase
        .from('chat_tags')
        .delete()
        .eq('chat_id', chatId)
        .eq('tag_id', tagId);

      // Filtrar por organization_id para segurança multi-tenant
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { error } = await query;

      if (error) {
        console.error('[chat-tags-webhook] Error removing tag:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chat-tags-webhook] Tag removed successfully`);
      return new Response(
        JSON.stringify({ success: true, message: 'Tag removida do chat com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chat-tags-webhook] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
