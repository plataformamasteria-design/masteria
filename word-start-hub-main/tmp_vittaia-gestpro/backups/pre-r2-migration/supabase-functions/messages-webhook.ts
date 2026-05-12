import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessageData {
  chat_id: string;
  content?: string;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'document' | 'video' | 'contact' | 'location' | 'pix';
  file_url?: string;
  file_base64?: string;
  file_name?: string;
  file_size?: number;
  is_from_user: boolean;
  organization_id: string;
  sender_name?: string;
  private?: boolean;
  sent_from_platform?: boolean; // true = sent from platform UI, false = registered via external API
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const method = req.method;
    console.log(`[messages-webhook] ${method} request received`);

    // GET - Listar mensagens de um chat
    if (method === 'GET') {
      const url = new URL(req.url);
      const chatId = url.searchParams.get('chat_id');
      const organizationId = url.searchParams.get('organization_id');
      const phone = url.searchParams.get('phone');
      const limit = url.searchParams.get('limit');
      const order = url.searchParams.get('order') || 'asc'; // 'asc' or 'desc'

      if (!organizationId) {
        console.error('[messages-webhook] Missing required parameter: organization_id');
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetro "organization_id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!chatId && !phone) {
        console.error('[messages-webhook] Missing required parameters: chat_id or phone');
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetro "chat_id" ou "phone" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let targetChatId = chatId;

      // If phone is provided, find the chat_id first
      if (phone && !chatId) {
        const cleanPhone = phone.replace(/\D/g, '');
        console.log(`[messages-webhook] Looking up chat by phone: ${cleanPhone}`);
        
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', cleanPhone)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (chatError) {
          console.error('[messages-webhook] Error finding chat by phone:', chatError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar chat pelo telefone' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!chatData) {
          console.log('[messages-webhook] No chat found for phone:', cleanPhone);
          return new Response(
            JSON.stringify({ success: true, data: [], message: 'Nenhum chat encontrado para este telefone' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        targetChatId = chatData.id;
      }

      console.log(`[messages-webhook] Fetching messages for chat: ${targetChatId}, organization: ${organizationId}, order: ${order}, limit: ${limit || 'all'}`);

      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', targetChatId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('platform_deleted_at', null)
        .order('created_at', { ascending: order === 'asc' });

      if (limit) {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          query = query.limit(limitNum);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('[messages-webhook] Error fetching messages:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Truncate message content to max 30 words
      const truncateContent = (content: string | null): string | null => {
        if (!content) return content;
        const words = content.split(/\s+/);
        if (words.length <= 30) return content;
        return words.slice(0, 30).join(' ') + '...';
      };

      const truncatedData = (data || []).map((msg: any) => ({
        ...msg,
        content: truncateContent(msg.content)
      }));

      console.log(`[messages-webhook] Found ${data?.length || 0} messages`);
      return new Response(
        JSON.stringify({ success: true, data: truncatedData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Enviar mensagem
    if (method === 'POST') {
      const body: MessageData = await req.json();

      if (!body.chat_id) {
        console.error('[messages-webhook] Missing required field: chat_id');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "chat_id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.message_type) {
        console.error('[messages-webhook] Missing required field: message_type');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "message_type" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.is_from_user === undefined) {
        console.error('[messages-webhook] Missing required field: is_from_user');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "is_from_user" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.organization_id) {
        console.error('[messages-webhook] Missing required field: organization_id');
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "organization_id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[messages-webhook] Processing message for chat: ${body.chat_id}, type: ${body.message_type}, from_user: ${body.is_from_user}, private: ${body.private || false}, organization: ${body.organization_id}`);

      // Handle base64 file upload if provided
      let fileUrl = body.file_url || null;
      let fileName = body.file_name || null;

      if (body.file_base64 && !['text', 'contact', 'location', 'pix'].includes(body.message_type)) {
        console.log(`[messages-webhook] Processing base64 file for type: ${body.message_type}`);
        
        try {
          // Remove data:mime;base64, prefix if present
          const base64Clean = body.file_base64.replace(/^data:[^;]+;base64,/, '');
          
          // Decode base64 to binary
          const binaryString = atob(base64Clean);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Determine file extension and mime type
          let fileExt = 'bin';
          let mimeType = 'application/octet-stream';
          
          switch (body.message_type) {
            case 'image':
              fileExt = 'jpg';
              mimeType = 'image/jpeg';
              break;
            case 'audio':
              fileExt = 'mp3';
              mimeType = 'audio/mpeg';
              break;
            case 'video':
              fileExt = 'mp4';
              mimeType = 'video/mp4';
              break;
            case 'pdf':
              fileExt = 'pdf';
              mimeType = 'application/pdf';
              break;
            case 'document':
              fileExt = fileName?.split('.').pop() || 'bin';
              break;
          }
          
          // Create file path
          const filePath = `${body.chat_id}/${Date.now()}.${fileExt}`;
          
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(filePath, bytes, {
              contentType: mimeType,
              upsert: false
            });
          
          if (uploadError) {
            console.error('[messages-webhook] Error uploading base64 to storage:', uploadError);
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('chat-files')
              .getPublicUrl(filePath);
            
            fileUrl = publicUrl;
            if (!fileName) {
              fileName = `file.${fileExt}`;
            }
            console.log(`[messages-webhook] Base64 file uploaded successfully: ${fileUrl}`);
          }
        } catch (error) {
          console.error('[messages-webhook] Error processing base64:', error);
        }
      }

      console.log(`[messages-webhook] Inserting message into database, sent_from_platform: ${body.sent_from_platform || false}`);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: body.chat_id,
          content: body.content || null,
          message_type: body.message_type,
          file_url: fileUrl,
          file_name: fileName,
          file_size: body.file_size || null,
          is_from_user: body.is_from_user,
          organization_id: body.organization_id,
          sender_name: body.sender_name || null,
          private: body.private || false,
          sent_from_platform: body.sent_from_platform || false,
          is_follow_up: false, // Mensagens enviadas via webhook NÃO são follow-up
        })
        .select()
        .single();

      if (error) {
        console.error('[messages-webhook] Error inserting message:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[messages-webhook] Message inserted successfully: ${data.id}`);

      // ONLY trigger sent webhooks if message was sent from the platform UI (sent_from_platform: true)
      // This prevents duplicate messages when external platforms (like WhatsApp directly) register messages
      if (body.sent_from_platform === true && !body.private) {
        console.log(`[messages-webhook] Platform message - triggering sent webhooks for: ${data.id}`);
        
        try {
          const triggerResponse = await supabase.functions.invoke('trigger-sent-webhooks', {
            body: { messageId: data.id }
          });

          if (triggerResponse.error) {
            console.error('[messages-webhook] Error triggering sent webhooks:', triggerResponse.error);
          } else {
            console.log('[messages-webhook] Sent webhooks triggered successfully:', triggerResponse.data);
          }
        } catch (webhookError) {
          console.error('[messages-webhook] Error invoking trigger-sent-webhooks:', webhookError);
          // Don't fail the main request if webhook trigger fails
        }
      } else if (body.is_from_user && !body.sent_from_platform) {
        console.log(`[messages-webhook] External platform message - NOT triggering webhooks to avoid duplication`);
      }

      // If message is from lead (is_from_user: false), check for active follow-up
      if (!body.is_from_user) {
        console.log(`[messages-webhook] Message from lead detected, checking for active follow-up`);
        
        try {
          // Get chat phone to pass to follow-up-message-received
          const { data: chatData } = await supabase
            .from('chats')
            .select('phone')
            .eq('id', body.chat_id)
            .single();

          if (chatData) {
            // Call follow-up-message-received function
            const followUpResponse = await supabase.functions.invoke('follow-up-message-received', {
              body: {
                phone: chatData.phone,
                message: body.content || 'Mensagem recebida'
              }
            });

            if (followUpResponse.error) {
              console.error('[messages-webhook] Error calling follow-up-message-received:', followUpResponse.error);
            } else {
              console.log('[messages-webhook] Follow-up check completed:', followUpResponse.data);
            }
          }
        } catch (followUpError) {
          console.error('[messages-webhook] Error in follow-up detection:', followUpError);
        }
      }

      // If message is from agent (is_from_user: true and sent_from_platform), clear transfer_requested_at and update last_read_at
      if (body.is_from_user && body.sent_from_platform && !body.private) {
        try {
          // Check if the sender is the assigned agent
          const { data: chatData } = await supabase
            .from('chats')
            .select('assigned_to, transfer_requested_at')
            .eq('id', body.chat_id)
            .single();

          // Agent responded - update last_read_at to mark all messages as read
          // Also clear transfer notification if present
          const updateData: { last_read_at: string; transfer_requested_at?: null } = {
            last_read_at: new Date().toISOString(),
          };
          
          if (chatData?.transfer_requested_at) {
            console.log('[messages-webhook] Agent responded, clearing transfer_requested_at');
            updateData.transfer_requested_at = null;
          }
          
          console.log('[messages-webhook] Agent responded, updating last_read_at');
          await supabase
            .from('chats')
            .update(updateData)
            .eq('id', body.chat_id);
        } catch (transferError) {
          console.error('[messages-webhook] Error updating chat after agent response:', transferError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover mensagem
    if (method === 'DELETE') {
      const url = new URL(req.url);
      const messageId = url.searchParams.get('message_id');
      const organizationId = url.searchParams.get('organization_id');

      if (!messageId || !organizationId) {
        console.error('[messages-webhook] Missing required parameters: message_id and organization_id');
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetros "message_id" e "organization_id" são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[messages-webhook] Deleting message: ${messageId}, organization: ${organizationId}`);

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('organization_id', organizationId);

      if (error) {
        console.error('[messages-webhook] Error deleting message:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[messages-webhook] Message deleted successfully`);
      return new Response(
        JSON.stringify({ success: true, message: 'Mensagem removida com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Método não suportado
    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[messages-webhook] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
