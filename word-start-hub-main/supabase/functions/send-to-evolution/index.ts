import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionConfig {
  url: string;
  apiKey: string;
  instanceName: string;
}

interface MessageData {
  id: string;
  chat_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  organization_id: string;
}

interface ChatData {
  phone: string;
  organization_id: string;
}

/**
 * Extract mention tokens from text (format: @token where token is digits or LID)
 * Returns the tokens (the part after @, before space)
 */
function extractMentionTokens(text: string): string[] {
  if (!text) return [];
  // Match @followed by alphanumeric (could be phone digits or LID numbers)
  const mentionPattern = /@(\d{8,20})/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(text)) !== null) {
    tokens.push(match[1]);
  }

  return tokens;
}

/**
 * Resolve mention tokens to full JIDs by looking up group_participants
 */
async function resolveMentionedJids(
  supabase: any,
  chatId: string,
  tokens: string[]
): Promise<string[]> {
  if (!tokens.length) return [];

  try {
    // Fetch participants for this group
    const { data: participants, error } = await supabase
      .from('group_participants')
      .select('participant_jid, participant_phone')
      .eq('group_chat_id', chatId);

    if (error || !participants?.length) {
      console.log('[send-to-evolution] No participants found for mention resolution');
      return tokens.map(t => `${t}@s.whatsapp.net`); // Fallback
    }

    const jids: string[] = [];
    for (const token of tokens) {
      // Try to find by JID token (the part before @)
      const byJid = participants.find((p: any) => {
        const jidToken = String(p.participant_jid || '').split('@')[0];
        return jidToken === token;
      });

      if (byJid) {
        jids.push(byJid.participant_jid);
        console.log('[send-to-evolution] Resolved mention token', token, 'to JID:', byJid.participant_jid);
        continue;
      }

      // Fallback: try to find by phone number
      const byPhone = participants.find((p: any) => p.participant_phone === token);
      if (byPhone) {
        jids.push(byPhone.participant_jid);
        console.log('[send-to-evolution] Resolved mention token', token, 'to JID via phone:', byPhone.participant_jid);
        continue;
      }

      // Last fallback: assume it's a regular phone and use @s.whatsapp.net
      jids.push(`${token}@s.whatsapp.net`);
      console.log('[send-to-evolution] Fallback mention token', token, 'to:', `${token}@s.whatsapp.net`);
    }

    return jids;
  } catch (e) {
    console.log('[send-to-evolution] resolveMentionedJids error:', e);
    return tokens.map(t => `${t}@s.whatsapp.net`);
  }
}

// Helper to send text message
// Evolution API v2 uses "mentioned" parameter (array of full JIDs like "5588xxx@s.whatsapp.net")
async function sendText(config: EvolutionConfig, number: string, text: string, mentioned?: string[]): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending text to ${number}`);
    const body: any = { number, text };

    // Evolution API uses "mentions" parameter (not "mentioned") with full JIDs
    if (mentioned && mentioned.length > 0) {
      // Ensure all JIDs are in the correct format with @s.whatsapp.net suffix
      body.mentions = mentioned.map(jid => {
        if (jid.includes('@')) return jid;
        return `${jid}@s.whatsapp.net`;
      });
      console.log(`[send-to-evolution] Including mentions:`, body.mentions);
      console.log(`[send-to-evolution] Full request body:`, JSON.stringify(body));
    }

    const response = await fetch(`${config.url}/message/sendText/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Text response:`, response.status, JSON.stringify(responseData));

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[send-to-evolution] Error sending text:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send audio message
async function sendAudio(config: EvolutionConfig, number: string, audioUrl: string): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending audio to ${number}`);
    const response = await fetch(`${config.url}/message/sendWhatsAppAudio/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({ number, audio: audioUrl }),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Audio response:`, response.status);

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[send-to-evolution] Error sending audio:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send media (image/video)
async function sendMedia(
  config: EvolutionConfig,
  number: string,
  mediaType: 'image' | 'video',
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending ${mediaType} to ${number}`);

    const body: any = {
      number,
      mediatype: mediaType,
      media: mediaUrl.includes(' ') ? encodeURI(mediaUrl) : mediaUrl,
    };

    if (mediaType === 'image') {
      body.mimetype = 'image/jpeg';
    }

    if (caption) {
      body.caption = caption;
    }

    const response = await fetch(`${config.url}/message/sendMedia/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Media response:`, response.status);

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error(`[send-to-evolution] Error sending ${mediaType}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send document (PDF, etc)
async function sendDocument(
  config: EvolutionConfig,
  number: string,
  docUrl: string,
  fileName: string,
  caption?: string
): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending document to ${number}: ${fileName}`);

    // Determine mimetype based on file extension
    let mimetype = 'application/octet-stream';
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'pdf') mimetype = 'application/pdf';
    else if (ext === 'doc') mimetype = 'application/msword';
    else if (ext === 'docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'xls') mimetype = 'application/vnd.ms-excel';
    else if (ext === 'xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const response = await fetch(`${config.url}/message/sendMedia/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number,
        mediatype: 'document',
        mimetype,
        media: docUrl,
        fileName,
        caption: caption || '',
      }),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Document response:`, response.status);

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[send-to-evolution] Error sending document:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send location
async function sendLocation(
  config: EvolutionConfig,
  number: string,
  locationData: { latitude: number; longitude: number; name?: string; address?: string }
): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending location to ${number}`);

    const response = await fetch(`${config.url}/message/sendLocation/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        name: locationData.name || '',
        address: locationData.address || '',
      }),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Location response:`, response.status);

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[send-to-evolution] Error sending location:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send contact
async function sendContact(
  config: EvolutionConfig,
  number: string,
  contactData: { display_name: string; phone: string; vcard?: string }
): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    console.log(`[send-to-evolution] Sending contact to ${number}`);

    const response = await fetch(`${config.url}/message/sendContact/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number,
        contact: [{
          fullName: contactData.display_name,
          phoneNumber: contactData.phone,
          wuid: `${contactData.phone.replace(/\D/g, '')}@s.whatsapp.net`,
        }],
      }),
    });

    const responseData = await response.json();
    console.log(`[send-to-evolution] Contact response:`, response.status);

    if (!response.ok) {
      return { success: false, error: `Evolution API error: ${response.status} - ${JSON.stringify(responseData)}` };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[send-to-evolution] Error sending contact:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send PIX as formatted text
async function sendPixAsText(
  config: EvolutionConfig,
  number: string,
  pixData: { key: string; key_type: string; merchant_name: string; reference_id?: string }
): Promise<{ success: boolean; error?: string; response?: any }> {
  const text = `💰 *Dados para pagamento PIX*

*Chave:* ${pixData.key}
*Tipo:* ${pixData.key_type}
*Beneficiário:* ${pixData.merchant_name}${pixData.reference_id ? `\n*Referência:* ${pixData.reference_id}` : ''}`;

  return sendText(config, number, text);
}

// Get Evolution API configuration
async function getEvolutionConfig(supabase: any, organizationId: string, overrideInstanceName?: string | null): Promise<EvolutionConfig | null> {
  // Get organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('slug, instance_name, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    console.error('[send-to-evolution] Organization not found:', orgError);
    return null;
  }

  // Get global config
  const { data: globalConfig, error: configError } = await supabase
    .from('global_config')
    .select('key, value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);

  if (configError) {
    console.error('[send-to-evolution] Error fetching global config:', configError);
    return null;
  }

  const globalEvolutionUrl = globalConfig?.find((c: any) => c.key === 'evolution_api_url')?.value;
  const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value;

  // Helper function to validate if a value looks like an API key (not a URL)
  const isValidApiKey = (value: string | null): boolean => {
    if (!value) return false;
    // API keys should NOT contain http:// or https://
    // API keys are typically alphanumeric strings
    return !value.includes('http://') && !value.includes('https://') && value.length > 10;
  };

  // Helper function to validate if a value looks like a URL
  const isValidUrl = (value: string | null): boolean => {
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://');
  };

  // Determine the correct URL
  let evolutionUrl: string | null = null;
  if (isValidUrl(org.evolution_api_url)) {
    evolutionUrl = org.evolution_api_url;
  } else if (isValidUrl(globalEvolutionUrl)) {
    evolutionUrl = globalEvolutionUrl;
  }

  // Determine the correct API key
  let evolutionKey: string | null = null;
  if (isValidApiKey(org.evolution_api_key)) {
    evolutionKey = org.evolution_api_key;
  } else if (isValidApiKey(globalEvolutionKey)) {
    evolutionKey = globalEvolutionKey;
  }

  console.log(`[send-to-evolution] Evolution config for org ${org.slug}: URL=${evolutionUrl ? 'found' : 'missing'}, Key=${evolutionKey ? 'found' : 'missing'}`);

  if (!evolutionUrl || !evolutionKey) {
    console.error('[send-to-evolution] Evolution API not configured properly');
    return null;
  }

  // Clean the URL
  let cleanUrl = evolutionUrl.replace(/\/$/, '');
  cleanUrl = cleanUrl.replace(/\/manager\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/api\/?$/, '');

  // Ignore generic channel names as instance overrides
  const genericChannels = ['whatsapp', 'evolution', 'whatsapp_cloud', 'facebook', 'instagram'];
  const validOverride = overrideInstanceName && !genericChannels.includes(overrideInstanceName.toLowerCase())
    ? overrideInstanceName
    : null;

  const instanceName = validOverride || org.instance_name || org.slug;

  console.log(`[send-to-evolution] Using Evolution instance: ${instanceName} (override was: ${overrideInstanceName})`);

  return {
    url: cleanUrl,
    apiKey: evolutionKey,
    instanceName,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { messageId, record } = body;

    let message: any = null;

    if (messageId) {
      console.log('[send-to-evolution] Processing message:', messageId);

      // Fetch message data
      const { data: dbMessage, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (messageError || !dbMessage) {
        console.error('[send-to-evolution] Message not found:', messageError);
        return new Response(
          JSON.stringify({ success: false, error: 'Message not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      message = dbMessage;
    } else if (record?.id && record?.chat_id && record?.organization_id) {
      console.log('[send-to-evolution] Processing legacy payload with record.id:', record.id);
      message = record;
    } else if (body?.phone && body?.organization_id && (body?.message || body?.content || body?.file_url)) {
      // Broadcast / direct-send mode: send directly to a phone number without needing a chat record
      console.log('[send-to-evolution] Processing broadcast/direct payload for phone:', body.phone);

      const config = await getEvolutionConfig(supabase, body.organization_id, body.channel || null);
      if (!config) {
        return new Response(
          JSON.stringify({ success: false, error: 'Evolution API not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const msgType = body.message_type || 'text';
      let result: { success: boolean; error?: string; response?: any };

      if (msgType === 'text') {
        result = await sendText(config, body.phone, body.message || body.content || '');
      } else if (msgType === 'audio' && body.file_url) {
        result = await sendAudio(config, body.phone, body.file_url);
      } else if (msgType === 'image' && body.file_url) {
        result = await sendMedia(config, body.phone, 'image', body.file_url, body.content || '');
      } else if (msgType === 'video' && body.file_url) {
        result = await sendMedia(config, body.phone, 'video', body.file_url, body.content || '');
      } else if ((msgType === 'pdf' || msgType === 'document') && body.file_url) {
        result = await sendDocument(config, body.phone, body.file_url, body.file_name || 'document.pdf', body.content || '');
      } else {
        result = await sendText(config, body.phone, body.message || body.content || '');
      }

      return new Response(
        JSON.stringify({ success: result.success, error: result.error, response: result.response }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (body?.chat_id && body?.organization_id) {
      console.log('[send-to-evolution] Processing legacy payload with direct message data');
      message = {
        id: body.id || `legacy-${crypto.randomUUID()}`,
        chat_id: body.chat_id,
        organization_id: body.organization_id,
        content: body.content || '',
        message_type: body.message_type || 'text',
        file_url: body.file_url || null,
        file_name: body.file_name || null,
        is_from_user: body.is_from_user ?? true,
        private: body.private ?? false,
      };
    } else {
      console.error('[send-to-evolution] No messageId or valid legacy payload provided');
      return new Response(
        JSON.stringify({ success: false, error: 'messageId or message payload is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip non-agent messages and private notes
    if (!message.is_from_user || message.private) {
      console.log('[send-to-evolution] Skipping: not an agent message or is private note');
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - not an agent message or is private note' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch chat data
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('phone, organization_id, channel')
      .eq('id', message.chat_id)
      .single();

    if (chatError || !chat) {
      console.error('[send-to-evolution] Chat not found:', chatError);
      return new Response(
        JSON.stringify({ success: false, error: 'Chat not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip Meta channels - they are handled by meta-send-message
    if (chat.channel === 'facebook' || chat.channel === 'instagram') {
      console.log(`[send-to-evolution] Skipping ${chat.channel} channel, routing to meta-send-message`);

      // Forward to meta-send-message
      const metaResponse = await fetch(`${supabaseUrl}/functions/v1/meta-send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ messageId: message.id }),
      });

      const metaResult = await metaResponse.json();
      return new Response(JSON.stringify(metaResult), {
        status: metaResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Evolution API config
    const evolutionConfig = await getEvolutionConfig(supabase, chat.organization_id, chat.channel);

    if (!evolutionConfig) {
      console.log('[send-to-evolution] Evolution API not configured, skipping send');
      return new Response(
        JSON.stringify({ success: true, message: 'Evolution API not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-to-evolution] Sending ${message.message_type} to ${chat.phone} via instance ${evolutionConfig.instanceName}`);

    let result: { success: boolean; error?: string; response?: any };

    // Route to appropriate sender based on message type
    switch (message.message_type) {
      case 'text': {
        const tokens = extractMentionTokens(message.content || '');
        const mentioned = await resolveMentionedJids(supabase, message.chat_id, tokens);
        result = await sendText(evolutionConfig, chat.phone, message.content || '', mentioned);
        break;
      }

      case 'audio':
        if (!message.file_url) {
          result = { success: false, error: 'No audio URL provided' };
        } else {
          result = await sendAudio(evolutionConfig, chat.phone, message.file_url.includes(' ') ? encodeURI(message.file_url) : message.file_url);
        }
        break;

      case 'image':
        if (!message.file_url) {
          result = { success: false, error: 'No image URL provided' };
        } else {
          result = await sendMedia(evolutionConfig, chat.phone, 'image', message.file_url.includes(' ') ? encodeURI(message.file_url) : message.file_url, message.content || undefined);
        }
        break;

      case 'video':
        if (!message.file_url) {
          result = { success: false, error: 'No video URL provided' };
        } else {
          result = await sendMedia(evolutionConfig, chat.phone, 'video', message.file_url.includes(' ') ? encodeURI(message.file_url) : message.file_url, message.content || undefined);
        }
        break;

      case 'document':
      case 'pdf':
        if (!message.file_url) {
          result = { success: false, error: 'No document URL provided' };
        } else {
          result = await sendDocument(
            evolutionConfig,
            chat.phone,
            message.file_url,
            message.file_name || 'document.pdf',
            message.content || undefined
          );
        }
        break;

      case 'location':
        try {
          const locationData = JSON.parse(message.content || '{}');
          if (!locationData.latitude || !locationData.longitude) {
            result = { success: false, error: 'Invalid location data' };
          } else {
            result = await sendLocation(evolutionConfig, chat.phone, locationData);
          }
        } catch (e) {
          result = { success: false, error: 'Failed to parse location data' };
        }
        break;

      case 'contact':
        try {
          const contactData = JSON.parse(message.content || '{}');
          if (!contactData.display_name || !contactData.phone) {
            result = { success: false, error: 'Invalid contact data' };
          } else {
            result = await sendContact(evolutionConfig, chat.phone, contactData);
          }
        } catch (e) {
          result = { success: false, error: 'Failed to parse contact data' };
        }
        break;

      case 'pix':
        try {
          const pixData = JSON.parse(message.content || '{}');
          if (!pixData.key || !pixData.key_type || !pixData.merchant_name) {
            result = { success: false, error: 'Invalid PIX data' };
          } else {
            result = await sendPixAsText(evolutionConfig, chat.phone, pixData);
          }
        } catch (e) {
          result = { success: false, error: 'Failed to parse PIX data' };
        }
        break;

      default:
        // For unknown types, try sending as text if there's content
        if (message.content) {
          console.log(`[send-to-evolution] Unknown type ${message.message_type}, sending as text`);
          result = await sendText(evolutionConfig, chat.phone, message.content);
        } else if (message.file_url) {
          // Try sending as document
          console.log(`[send-to-evolution] Unknown type ${message.message_type}, sending as document`);
          result = await sendDocument(
            evolutionConfig,
            chat.phone,
            message.file_url,
            message.file_name || 'file'
          );
        } else {
          result = { success: false, error: `Unsupported message type: ${message.message_type}` };
        }
    }

    if (!result.success) {
      console.error(`[send-to-evolution] Failed to send message:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-to-evolution] Message sent successfully`);

    // Persist external_message_id (so we can:
    // 1) avoid duplicates when webhook upserts the same outbound message
    // 2) update delivered/read status via MESSAGES_UPDATE)
    try {
      const resp = result.response;
      const externalId =
        resp?.key?.id ??
        resp?.message?.key?.id ??
        resp?.data?.key?.id ??
        resp?.messageId ??
        resp?.id ??
        null;

      if (externalId && typeof externalId === 'string') {
        await supabase
          .from('messages')
          .update({ external_message_id: externalId })
          .eq('id', message.id);

        console.log('[send-to-evolution] Saved external_message_id:', externalId);
      } else {
        console.log('[send-to-evolution] Could not extract external_message_id from response');
      }
    } catch (e) {
      console.error('[send-to-evolution] Failed saving external_message_id:', e);
    }

    // Update last_read_at to mark all messages as read when agent sends message
    try {
      await supabase
        .from('chats')
        .update({ last_read_at: new Date().toISOString() })
        .eq('id', message.chat_id);
      console.log(`[send-to-evolution] Updated last_read_at for chat ${message.chat_id}`);
    } catch (readError) {
      console.error('[send-to-evolution] Error updating last_read_at:', readError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent to Evolution API',
        evolutionResponse: result.response
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-to-evolution] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
