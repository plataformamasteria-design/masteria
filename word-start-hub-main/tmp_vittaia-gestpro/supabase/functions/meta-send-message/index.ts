import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { messageId } = body;

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only send outgoing messages
    if (!message.is_from_user) {
      return new Response(JSON.stringify({ error: 'Cannot send incoming messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip internal notes
    if (message.private) {
      return new Response(JSON.stringify({ success: true, skipped: 'internal_note' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch chat to get the recipient
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('phone, channel, organization_id')
      .eq('id', message.chat_id)
      .single();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===================== WHATSAPP CLOUD API =====================
    if (chat.channel === 'whatsapp_cloud') {
      return await sendViaWhatsAppCloud(supabase, message, chat, messageId);
    }

    // ===================== FACEBOOK / INSTAGRAM =====================
    if (chat.channel !== 'facebook' && chat.channel !== 'instagram') {
      return new Response(JSON.stringify({ error: 'Not a Meta channel chat' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract recipient ID from phone field (format: "facebook:<id>" or "instagram:<id>")
    const recipientId = chat.phone.split(':')[1];
    if (!recipientId) {
      return new Response(JSON.stringify({ error: 'Invalid recipient format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get page access token
    const { data: connections } = await supabase
      .from('meta_connections')
      .select('page_id, page_access_token')
      .eq('organization_id', chat.organization_id)
      .eq('is_active', true)
      .limit(1);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: 'No Meta connection found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pageAccessToken = connections[0].page_access_token;

    // Send message via Meta Graph API (Messenger/Instagram)
    let apiBody: any;

    if (message.message_type === 'text') {
      apiBody = {
        recipient: { id: recipientId },
        message: { text: message.content || '' },
        messaging_type: 'RESPONSE',
      };
    } else if (message.message_type === 'image' && message.file_url) {
      apiBody = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'image',
            payload: { url: message.file_url, is_reusable: true },
          },
        },
        messaging_type: 'RESPONSE',
      };
    } else if (message.message_type === 'video' && message.file_url) {
      apiBody = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'video',
            payload: { url: message.file_url, is_reusable: true },
          },
        },
        messaging_type: 'RESPONSE',
      };
    } else if (message.message_type === 'audio' && message.file_url) {
      apiBody = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'audio',
            payload: { url: message.file_url, is_reusable: true },
          },
        },
        messaging_type: 'RESPONSE',
      };
    } else if ((message.message_type === 'document' || message.message_type === 'pdf') && message.file_url) {
      apiBody = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'file',
            payload: { url: message.file_url, is_reusable: true },
          },
        },
        messaging_type: 'RESPONSE',
      };
    } else {
      // Fallback to text
      apiBody = {
        recipient: { id: recipientId },
        message: { text: message.content || message.file_name || 'Mensagem' },
        messaging_type: 'RESPONSE',
      };
    }

    console.log(`[meta-send] Sending ${message.message_type} to ${recipientId}`);

    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
      }
    );

    const responseData = await response.json();

    if (!response.ok || responseData.error) {
      console.error('[meta-send] Error:', responseData.error);
      return new Response(JSON.stringify({
        success: false,
        error: responseData.error?.message || 'Send failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update message with external ID
    if (responseData.message_id) {
      await supabase
        .from('messages')
        .update({
          meta_message_id: responseData.message_id,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', messageId);
    }

    console.log(`[meta-send] Message sent successfully: ${responseData.message_id}`);

    return new Response(JSON.stringify({ success: true, meta_message_id: responseData.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[meta-send] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Send a message via WhatsApp Cloud API.
 * Uses /{phone_number_id}/messages endpoint with Bearer auth.
 */
async function sendViaWhatsAppCloud(
  supabase: any,
  message: any,
  chat: any,
  messageId: string
): Promise<Response> {
  // Extract recipient phone from chat.phone (format: "whatsapp_cloud:<phone>")
  const recipientPhone = chat.phone.split(':')[1];
  if (!recipientPhone) {
    return new Response(JSON.stringify({ error: 'Invalid WA Cloud recipient' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get WhatsApp Cloud config from org settings
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', chat.organization_id)
    .single();

  const settings = org?.settings || {};
  const phoneNumberId = settings.whatsapp_cloud_phone_number_id;
  const accessToken = settings.whatsapp_cloud_access_token;

  if (!phoneNumberId || !accessToken) {
    return new Response(JSON.stringify({ error: 'WhatsApp Cloud not configured for this org' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build WhatsApp Cloud API payload
  let waPayload: any;

  if (message.message_type === 'text') {
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: message.content || '' },
    };
  } else if (message.message_type === 'image' && message.file_url) {
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'image',
      image: { link: message.file_url, caption: message.content || undefined },
    };
  } else if (message.message_type === 'video' && message.file_url) {
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'video',
      video: { link: message.file_url, caption: message.content || undefined },
    };
  } else if (message.message_type === 'audio' && message.file_url) {
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'audio',
      audio: { link: message.file_url },
    };
  } else if ((message.message_type === 'document' || message.message_type === 'pdf') && message.file_url) {
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'document',
      document: {
        link: message.file_url,
        filename: message.file_name || 'document',
        caption: message.content || undefined,
      },
    };
  } else {
    // Fallback to text
    waPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: message.content || message.file_name || 'Mensagem' },
    };
  }

  console.log(`[wa-cloud-send] Sending ${message.message_type} to ${recipientPhone} via ${phoneNumberId}`);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(waPayload),
    }
  );

  const responseData = await response.json();

  if (!response.ok || responseData.error) {
    console.error('[wa-cloud-send] Error:', responseData.error);
    return new Response(JSON.stringify({
      success: false,
      error: responseData.error?.message || 'WA Cloud send failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update message with external ID
  const waMessageId = responseData.messages?.[0]?.id;
  if (waMessageId) {
    await supabase
      .from('messages')
      .update({
        meta_message_id: waMessageId,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', messageId);
  }

  console.log(`[wa-cloud-send] ✅ Message sent: ${waMessageId}`);

  return new Response(JSON.stringify({ success: true, meta_message_id: waMessageId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
