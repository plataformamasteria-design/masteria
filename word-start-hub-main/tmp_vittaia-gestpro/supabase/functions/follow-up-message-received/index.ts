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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, message, organization_id } = await req.json();

    console.log(`[follow-up-message-received] Received message from: ${phone}, org: ${organization_id || 'not specified'}`);

    // Find chat by phone - scope by organization_id if provided
    let chatQuery = supabase
      .from('chats')
      .select('id, organization_id')
      .eq('phone', phone)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (organization_id) {
      chatQuery = chatQuery.eq('organization_id', organization_id);
    }

    const { data: chat, error: chatError } = await chatQuery.maybeSingle();

    if (chatError) throw chatError;

    if (!chat) {
      console.log(`[follow-up-message-received] Chat not found for phone: ${phone}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Chat not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find active tracking for this chat (scoped to same organization)
    const { data: tracking, error: trackingError } = await supabase
      .from('lead_follow_up_tracking')
      .select('*')
      .eq('chat_id', chat.id)
      .eq('organization_id', chat.organization_id)
      .eq('completed', false)
      .eq('responded', false)
      .maybeSingle();

    if (trackingError) throw trackingError;

    if (tracking) {
      console.log(`[follow-up-message-received] Active tracking found for ${phone}, checking if valid response`);

      // Buscar última mensagem válida (não de follow-up, não do sistema)
      // is_from_user = false means message FROM the WhatsApp contact (lead)
      // is_from_user = true means message FROM the platform/agent
      const { data: lastValidMessage, error: messageError } = await supabase
        .from('messages')
        .select('is_from_user, created_at, content, is_follow_up')
        .eq('chat_id', chat.id)
        .eq('private', false)
        .or('is_follow_up.is.null,is_follow_up.eq.false')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (messageError) throw messageError;

      // Verificar se é mensagem do sistema
      const isSystemMessage = lastValidMessage?.content && (
        lastValidMessage.content.includes("atribuiu a conversa") ||
        lastValidMessage.content.includes("transferiu a conversa") ||
        lastValidMessage.content.includes("iniciou a conversa") ||
        lastValidMessage.content.includes("arquivou") ||
        lastValidMessage.content.includes("marcou como resolvido") ||
        lastValidMessage.content.includes("desatribuiu a conversa")
      );

      // is_from_user = false => message from lead
      const isFromLead = lastValidMessage?.is_from_user === false && !isSystemMessage;
      
      let isAfterFollowUp = true;
      if (tracking.last_sent_at && lastValidMessage?.created_at) {
        const messageTime = new Date(lastValidMessage.created_at).getTime();
        const followUpTime = new Date(tracking.last_sent_at).getTime();
        isAfterFollowUp = messageTime > followUpTime;
      }

      if (!isFromLead) {
        console.log(`[follow-up-message-received] Last valid message is not from lead, checking if agent responded`);
        
        // is_from_user = true => agent/platform message
        if (lastValidMessage?.is_from_user === true && !isSystemMessage) {
          console.log(`[follow-up-message-received] Agent responded, marking as recovered`);
          
          await supabase
            .from('lead_follow_up_tracking')
            .update({
              responded: true,
              responded_at_step: tracking.current_step,
              completed: true,
            })
            .eq('id', tracking.id);

          // Cancel pending queue items
          await supabase
            .from('follow_up_queue')
            .update({ status: 'cancelled', error_message: 'Agent responded' })
            .eq('tracking_id', tracking.id)
            .in('status', ['pending', 'processing']);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Agent responded, follow-up sequence stopped',
              responded_at_step: tracking.current_step,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Last valid message is not from lead or agent, sequence continues'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isAfterFollowUp) {
        console.log(`[follow-up-message-received] Message was sent before follow-up, not counting as response`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Message was sent before follow-up, not counting as response'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Valid response from lead - STOP SEQUENCE IMMEDIATELY
      console.log(`[follow-up-message-received] Valid response from lead ${phone}, stopping sequence`);

      await supabase
        .from('lead_follow_up_tracking')
        .update({
          responded: true,
          responded_at_step: tracking.current_step,
          completed: true,
        })
        .eq('id', tracking.id);

      // Cancel pending queue items
      await supabase
        .from('follow_up_queue')
        .update({ 
          status: 'cancelled',
          error_message: 'Lead responded'
        })
        .eq('tracking_id', tracking.id)
        .in('status', ['pending', 'processing']);

      // Update chat updated_at
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chat.id);

      console.log(`[follow-up-message-received] Lead ${phone} responded, sequence stopped`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead responded, follow-up sequence stopped',
          responded_at_step: tracking.current_step,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: 'No active follow-up found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[follow-up-message-received] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});