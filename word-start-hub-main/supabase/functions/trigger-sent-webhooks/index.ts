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

type EvolutionSendResult = { success: boolean; error?: string; response?: any };

type EvolutionQuoted = {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
};

// Unified webhook payload (same format as evolution-webhook-receiver)
interface WebhookPayload {
  // Basic message info
  chatid: string;
  grupo: boolean;
  idmensagem: string;
  telefone: string;
  tipo: string;
  message: string;
  
  // Direction
  'from-me': boolean;
  direction: 'outgoing' | 'incoming';
  
  // Profile info
  'foto-perfil': string;
  'nome-whatsapp': string;
  
  // Organization data
  organization_id: string;
  instancia: string;
  token: string;
  
  // Internal IDs
  chat_id: string;
  message_id: string;
  
  // Group info
  group_name: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  
  // Evolution data (null for platform-sent messages)
  evolution_data: any | null;
  
  // File URLs
  file_url: string | null;
  file_name: string | null;
  audio_url: string | null;
  image_url: string | null;
  video_url: string | null;
  document_url: string | null;
  
  // Supabase info
  supabase_url: string;
  supabase_anon_key: string;
  
  // Special data types
  contact_data?: {
    display_name: string;
    phone: string;
    vcard?: string;
  };
  location_data?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  pix_data?: {
    key: string;
    key_type: string;
    merchant_name: string;
    reference_id?: string;
  };
}

// ==================== MENTION HELPERS ====================

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
      console.log('[trigger-sent-webhooks] No participants found for mention resolution');
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
        // Prefer real phone JID when we have the phone saved (WhatsApp mentions expect @s.whatsapp.net)
        const phoneDigits = String(byJid.participant_phone || '').replace(/\D/g, '');
        const preferred = phoneDigits ? `${phoneDigits}@s.whatsapp.net` : String(byJid.participant_jid || '');
        jids.push(preferred);
        console.log('[trigger-sent-webhooks] Resolved mention token', token, 'to JID:', preferred);
        continue;
      }
      
      // Fallback: try to find by phone number
      const byPhone = participants.find((p: any) => p.participant_phone === token);
      if (byPhone) {
        const phoneDigits = String(byPhone.participant_phone || '').replace(/\D/g, '');
        const preferred = phoneDigits ? `${phoneDigits}@s.whatsapp.net` : String(byPhone.participant_jid || '');
        jids.push(preferred);
        console.log('[trigger-sent-webhooks] Resolved mention token', token, 'to JID via phone:', preferred);
        continue;
      }
      
      // Last fallback: assume it's a regular phone and use @s.whatsapp.net
      jids.push(`${token}@s.whatsapp.net`);
      console.log('[trigger-sent-webhooks] Fallback mention token', token, 'to:', `${token}@s.whatsapp.net`);
    }
    
    return jids;
  } catch (e) {
    console.log('[trigger-sent-webhooks] resolveMentionedJids error:', e);
    return tokens.map(t => `${t}@s.whatsapp.net`);
  }
}

// ==================== EVOLUTION API HELPERS ====================

async function sendTextToEvolution(
  config: EvolutionConfig,
  number: string,
  text: string,
  quoted?: EvolutionQuoted,
  mentionedJid?: string[]
): Promise<EvolutionSendResult> {
  try {
    const body: any = { number, text };
    if (quoted) body.quoted = quoted;

    // WhatsApp group mentions are activated by metadata: `mentions: ["<jid>"]`
    if (mentionedJid && mentionedJid.length > 0) {
      const unique = Array.from(new Set(mentionedJid.filter(Boolean).map((j) => String(j))));
      body.mentions = unique;
      console.log('[trigger-sent-webhooks] Including mentions:', body.mentions);
    }
    
    const response = await fetch(`${config.url}/message/sendText/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendAudioToEvolution(
  config: EvolutionConfig,
  number: string,
  audioUrl: string,
  quoted?: EvolutionQuoted
): Promise<EvolutionSendResult> {
  try {
    const response = await fetch(`${config.url}/message/sendWhatsAppAudio/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify({ number, audio: audioUrl, ...(quoted ? { quoted } : {}) }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendMediaToEvolution(
  config: EvolutionConfig, 
  number: string, 
  mediaType: 'image' | 'video', 
  mediaUrl: string,
  caption?: string,
  quoted?: EvolutionQuoted
): Promise<EvolutionSendResult> {
  try {
    const body: any = { number, mediatype: mediaType, media: mediaUrl };
    if (mediaType === 'image') body.mimetype = 'image/jpeg';
    if (caption) body.caption = caption;
    if (quoted) body.quoted = quoted;
    
    const response = await fetch(`${config.url}/message/sendMedia/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendDocumentToEvolution(
  config: EvolutionConfig, 
  number: string, 
  docUrl: string, 
  fileName: string,
  caption?: string,
  quoted?: EvolutionQuoted
): Promise<EvolutionSendResult> {
  try {
    let mimetype = 'application/octet-stream';
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'pdf') mimetype = 'application/pdf';
    else if (ext === 'doc') mimetype = 'application/msword';
    else if (ext === 'docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    const body: any = {
      number,
      mediatype: 'document',
      mimetype,
      media: docUrl,
      fileName,
      caption: caption || '',
    };
    if (quoted) body.quoted = quoted;

    const response = await fetch(`${config.url}/message/sendMedia/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendLocationToEvolution(
  config: EvolutionConfig, 
  number: string, 
  locationData: { latitude: number; longitude: number; name?: string; address?: string }
): Promise<EvolutionSendResult> {
  try {
    const response = await fetch(`${config.url}/message/sendLocation/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify({
        number,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        name: locationData.name || '',
        address: locationData.address || '',
      }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendContactToEvolution(
  config: EvolutionConfig, 
  number: string, 
  contactData: { display_name: string; phone: string }
): Promise<EvolutionSendResult> {
  try {
    const response = await fetch(`${config.url}/message/sendContact/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify({
        number,
        contact: [{
          fullName: contactData.display_name,
          phoneNumber: contactData.phone,
          wuid: `${contactData.phone.replace(/\D/g, '')}@s.whatsapp.net`,
        }],
      }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Evolution API error: ${response.status} - ${errorData}` };
    }
    const data = await safeJson(response);
    return { success: true, response: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendPixAsTextToEvolution(
  config: EvolutionConfig, 
  number: string, 
  pixData: { key: string; key_type: string; merchant_name: string; reference_id?: string }
): Promise<EvolutionSendResult> {
  const text = `💰 *Dados para pagamento PIX*

*Chave:* ${pixData.key}
*Tipo:* ${pixData.key_type}
*Beneficiário:* ${pixData.merchant_name}${pixData.reference_id ? `\n*Referência:* ${pixData.reference_id}` : ''}`;

  return sendTextToEvolution(config, number, text);
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractExternalMessageIdFromEvolutionResponse(resp: any): string | null {
  const externalId =
    resp?.key?.id ??
    resp?.message?.key?.id ??
    resp?.data?.key?.id ??
    resp?.messageId ??
    resp?.id ??
    null;
  return typeof externalId === 'string' && externalId.trim() ? externalId : null;
}

function toRemoteJid(chatPhone: string, isGroup: boolean): string {
  if (isGroup) return chatPhone;
  const digits = (chatPhone || '').replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

async function getEvolutionConfig(supabase: any, organizationId: string, overrideInstanceName?: string | null): Promise<EvolutionConfig | null> {
  // Get organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('slug, instance_name, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    console.log('[trigger-sent-webhooks] Organization not found for Evolution config');
    return null;
  }

  // Get global config
  const { data: globalConfig } = await supabase
    .from('global_config')
    .select('key, value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);

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

  console.log(`[trigger-sent-webhooks] Evolution config for org ${org.slug}: URL=${evolutionUrl ? 'found' : 'missing'}, Key=${evolutionKey ? 'found' : 'missing'}`);

  if (!evolutionUrl || !evolutionKey) {
    console.log('[trigger-sent-webhooks] Missing Evolution API configuration');
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

  console.log(`[trigger-sent-webhooks] Using Evolution instance: ${instanceName} (override was: ${overrideInstanceName})`);

  return { url: cleanUrl, apiKey: evolutionKey, instanceName };
}

async function sendToEvolutionApi(
  supabase: any,
  record: any,
  phone: string,
  channel: string | null
): Promise<{ success: boolean; error?: string; externalMessageId?: string | null }> {
  const evolutionConfig = await getEvolutionConfig(supabase, record.organization_id, channel);
  
  if (!evolutionConfig) {
    console.log('[trigger-sent-webhooks] Evolution API not configured, skipping direct send');
    return { success: true }; // Not an error, just not configured
  }

  console.log(`[trigger-sent-webhooks] Sending ${record.message_type} to Evolution API via instance ${evolutionConfig.instanceName}`);

  // Resolve quoted (if any)
  let quoted: EvolutionQuoted | undefined;
  try {
    const quotedExternalId = record?.quoted_external_message_id || null;
    if (quotedExternalId) {
      const { data: quotedMsg } = await supabase
        .from('messages')
        .select('is_from_user')
        .eq('external_message_id', quotedExternalId)
        .eq('organization_id', record.organization_id)
        .maybeSingle();

      quoted = {
        key: {
          remoteJid: toRemoteJid(phone, !!record?.is_group),
          fromMe: !!quotedMsg?.is_from_user,
          id: quotedExternalId,
        },
      };

      console.log('[trigger-sent-webhooks] Using quoted:', quoted.key);
    }
  } catch (e) {
    console.log('[trigger-sent-webhooks] Failed resolving quoted message:', e);
  }

  let result: EvolutionSendResult;

  switch (record.message_type) {
    case 'text': {
      // For group chats, resolve mentions from the database
      // For 1:1 chats, use simple phone-based JID
      const tokens = extractMentionTokens(record.content || '');
      const mentionedJid = record.chat_id 
        ? await resolveMentionedJids(supabase, record.chat_id, tokens)
        : tokens.map((t: string) => `${t}@s.whatsapp.net`);
      result = await sendTextToEvolution(evolutionConfig, phone, record.content || '', quoted, mentionedJid);
      break;
    }

    case 'audio':
      if (!record.file_url) {
        result = { success: false, error: 'No audio URL provided' };
      } else {
        result = await sendAudioToEvolution(evolutionConfig, phone, record.file_url, quoted);
      }
      break;

    case 'image':
      if (!record.file_url) {
        result = { success: false, error: 'No image URL provided' };
      } else {
        result = await sendMediaToEvolution(evolutionConfig, phone, 'image', record.file_url, record.content || undefined, quoted);
      }
      break;

    case 'video':
      if (!record.file_url) {
        result = { success: false, error: 'No video URL provided' };
      } else {
        result = await sendMediaToEvolution(evolutionConfig, phone, 'video', record.file_url, record.content || undefined, quoted);
      }
      break;

    case 'document':
    case 'pdf':
      if (!record.file_url) {
        result = { success: false, error: 'No document URL provided' };
      } else {
        result = await sendDocumentToEvolution(
          evolutionConfig, 
          phone, 
          record.file_url, 
          record.file_name || 'document.pdf',
          record.content || undefined,
          quoted
        );
      }
      break;

    case 'location':
      try {
        const locationData = JSON.parse(record.content || '{}');
        if (!locationData.latitude || !locationData.longitude) {
          result = { success: false, error: 'Invalid location data' };
        } else {
          result = await sendLocationToEvolution(evolutionConfig, phone, locationData);
        }
      } catch (e) {
        result = { success: false, error: 'Failed to parse location data' };
      }
      break;

    case 'contact':
      try {
        const contactData = JSON.parse(record.content || '{}');
        if (!contactData.display_name || !contactData.phone) {
          result = { success: false, error: 'Invalid contact data' };
        } else {
          result = await sendContactToEvolution(evolutionConfig, phone, contactData);
        }
      } catch (e) {
        result = { success: false, error: 'Failed to parse contact data' };
      }
      break;

    case 'pix':
      try {
        const pixData = JSON.parse(record.content || '{}');
        if (!pixData.key || !pixData.key_type || !pixData.merchant_name) {
          result = { success: false, error: 'Invalid PIX data' };
        } else {
          result = await sendPixAsTextToEvolution(evolutionConfig, phone, pixData);
        }
      } catch (e) {
        result = { success: false, error: 'Failed to parse PIX data' };
      }
      break;

    default:
      // For unknown types, try sending as text if there's content
      if (record.content) {
        result = await sendTextToEvolution(evolutionConfig, phone, record.content, quoted);
      } else if (record.file_url) {
        result = await sendDocumentToEvolution(evolutionConfig, phone, record.file_url, record.file_name || 'file', undefined, quoted);
      } else {
        result = { success: false, error: `Unsupported message type: ${record.message_type}` };
      }
  }

  if (!result.success) {
    console.error(`[trigger-sent-webhooks] Evolution API send failed:`, result.error);
  } else {
    console.log(`[trigger-sent-webhooks] Message sent to Evolution API successfully`);
  }

  const externalMessageId = result.success ? extractExternalMessageIdFromEvolutionResponse(result.response) : null;
  if (result.success) {
    console.log('[trigger-sent-webhooks] Evolution response external_message_id:', externalMessageId || '(not found)');
  }

  return { success: result.success, error: result.error, externalMessageId };
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // LOG INICIO
  const tempLog = (msg: string) => supabase.from('ghl_sync_logs').insert({
    organization_id: '00000000-0000-0000-0000-000000000000',
    direction: 'vitta_to_ghl',
    resource_type: 'trigger-webhooks-debug',
    message: msg,
    status: 'success'
  }).then();

  tempLog('STARTED trigger-sent-webhooks execution');

  try {
    const body = await req.json();
    
    // Support both { record } (legacy) and { messageId } (new)
    let record = body.record;
    
    if (!record && body.messageId) {
      console.log('[trigger-sent-webhooks] Fetching message by ID:', body.messageId);
      
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', body.messageId)
        .single();
      
      if (messageError || !messageData) {
        console.error('[trigger-sent-webhooks] Message not found:', messageError);
        return new Response(
          JSON.stringify({ success: false, error: 'Message not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      record = messageData;
    }
    
    if (!record) {
      tempLog('No record or messageId provided');
      return new Response(
        JSON.stringify({ success: false, error: 'No record or messageId provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    tempLog('Processing record: ' + record.id);
    
    // Processar apenas mensagens enviadas pelo AGENTE (is_from_user: true no sistema significa agente enviou)
    // e NÃO privadas (notas internas não devem disparar webhook)
    if (!record.is_from_user || record.private) {
      console.log('[trigger-sent-webhooks] Skipping: lead message or private note (is_from_user:', record.is_from_user, ', private:', record.private, ')');
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - lead message or private note' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[trigger-sent-webhooks] Processing agent message for organization:', record.organization_id);

    // Buscar informações completas do chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, phone, channel, is_group, group_name, group_photo_url, wa_name, wa_photo_url')
      .eq('id', record.chat_id)
      .single();

    if (chatError || !chat) {
      console.error('[trigger-sent-webhooks] Error fetching chat:', chatError);
      throw new Error('Chat not found');
    }

    // Buscar informações da organização e configuração Evolution
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, slug, instance_name, evolution_api_url, evolution_api_key')
      .eq('id', record.organization_id)
      .single();

    // Buscar configuração global do Evolution
    const { data: globalConfig } = await supabase
      .from('global_config')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key']);

    const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value;

    // Determinar instance_name e token
    const instanceName = organization?.instance_name || organization?.slug || '';
    const evolutionToken = organization?.evolution_api_key || globalEvolutionKey || '';

    let evolutionResult: { success: boolean; error?: string; externalMessageId?: string | null } = { success: false };

    // ==================== STEP 1: SEND MESSAGE ====================
    if (chat.channel === 'facebook' || chat.channel === 'instagram' || chat.channel === 'whatsapp_cloud') {
      console.log(`[trigger-sent-webhooks] Meta channel detected (${chat.channel}), routing to meta-send-message`);
      
      try {
        const metaResponse = await fetch(`${supabaseUrl}/functions/v1/meta-send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ messageId: record.id }),
        });
        
        const metaResult = await metaResponse.json().catch(() => null);
        
        evolutionResult = {
          success: metaResponse.ok,
          error: metaResponse.ok ? undefined : (metaResult?.error || 'Meta send failed'),
          externalMessageId: metaResult?.meta_message_id || null
        };
      } catch (err) {
        evolutionResult = { success: false, error: err instanceof Error ? err.message : 'Unknown Meta API Error' };
      }
    } else {
      // ==================== SEND TO EVOLUTION API DIRECTLY ====================
      evolutionResult = await sendToEvolutionApi(
        supabase,
        { ...record, is_group: chat.is_group },
        chat.phone,
        chat.channel
      );
    }
    
    if (!evolutionResult.success) {
      console.error('[trigger-sent-webhooks] Failed to send message to provider:', evolutionResult.error);
      
      try {
        await supabase
          .from('messages')
          .update({
            failed_at: new Date().toISOString(),
            error_message: evolutionResult.error || 'Falha ao enviar mensagem',
          })
          .eq('id', record.id);
      } catch (err) {
        console.error('[trigger-sent-webhooks] Error updating message failure status:', err);
      }
      
      // Continue to webhooks even if sending fails - they might want to handle it differently
    }

    // Persist external_message_id if we got it (critical for: reply/edit/delete)
    try {
      if (evolutionResult.success && evolutionResult.externalMessageId && !record.external_message_id) {
        await supabase
          .from('messages')
          .update({ external_message_id: evolutionResult.externalMessageId })
          .eq('id', record.id);

        // Keep local variable for webhook payload
        record.external_message_id = evolutionResult.externalMessageId;
        console.log('[trigger-sent-webhooks] Saved external_message_id:', evolutionResult.externalMessageId);
      }
    } catch (e) {
      console.error('[trigger-sent-webhooks] Failed saving external_message_id:', e);
    }

    // ==================== [HOTFIX] TRIGGER GHL OUTBOUND SYNC ====================
    // Messages sent directly from the platform UI bypass messages-webhook, so we must sync them here.
    try {
      console.log(`[trigger-sent-webhooks] Triggering GHL outbound sync for message: ${record.id}`);
      const ghlPromise = supabase.functions.invoke('ghl-outbound-sync', {
        body: {
          type: 'INSERT',
          table: 'messages',
          schema: 'public',
          record: {
            ...record,
            external_message_id: record.external_message_id // Emphasize updated external id
          },
        }
      });
      // Await gracefully to ensure Deno doesn't kill the isolate before the request is dispatched
      // Note: This adds ~1-2s to the UI response time, but guarantees GHL sync executes reliably.
      await ghlPromise;
    } catch (ghlErr) {
      console.error('[trigger-sent-webhooks] Non-blocking GHL sync error:', ghlErr);
    }

    // ==================== STEP 2: SEND TO EXTERNAL WEBHOOKS (if any) ====================
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('webhook_type', 'sent')
      .eq('active', true)
      .eq('organization_id', record.organization_id);

    if (webhooksError) {
      console.error('[trigger-sent-webhooks] Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }

    console.log(`[trigger-sent-webhooks] Found ${webhooks?.length || 0} webhooks for organization ${record.organization_id}`);

    // If no webhooks, return early with Evolution result
    if (!webhooks || webhooks.length === 0) {
      console.log('[trigger-sent-webhooks] No active webhooks found for this organization');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message processed',
          evolutionSent: evolutionResult.success,
          evolutionError: evolutionResult.error,
          webhooksCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar informações do agente que enviou
    let agentName = 'Sistema';
    if (record.sent_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', record.sent_by)
        .single();

      if (profile) {
        agentName = profile.full_name || profile.email || 'Agente';
      }
    }

    // Extrair telefone limpo (sem @s.whatsapp.net)
    const cleanPhone = chat.phone?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';

    // Determinar URLs de mídia específicas baseado no tipo
    let audioUrl: string | null = null;
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    let documentUrl: string | null = null;

    if (record.file_url) {
      switch (record.message_type) {
        case 'audio':
          audioUrl = record.file_url;
          break;
        case 'image':
          imageUrl = record.file_url;
          break;
        case 'video':
          videoUrl = record.file_url;
          break;
        case 'document':
        case 'pdf':
          documentUrl = record.file_url;
          break;
      }
    }

    // Preparar payload no MESMO FORMATO do evolution-webhook-receiver
    const payload: WebhookPayload = {
      // Basic message info
      chatid: chat.phone, // Formato WhatsApp (com @s.whatsapp.net ou @g.us)
      grupo: chat.is_group || false,
      idmensagem: record.external_message_id || record.id,
      telefone: cleanPhone,
      tipo: record.message_type,
      message: record.content || '',
      
      // Direction - ALWAYS outgoing for sent messages
      'from-me': true,
      direction: 'outgoing',
      
      // Profile info (do lead/grupo)
      'foto-perfil': chat.is_group ? (chat.group_photo_url || '') : (chat.wa_photo_url || ''),
      'nome-whatsapp': chat.is_group ? (chat.group_name || 'Grupo') : (chat.wa_name || ''),
      
      // Organization data
      organization_id: record.organization_id,
      instancia: instanceName,
      token: evolutionToken,
      
      // Internal IDs
      chat_id: chat.id,
      message_id: record.id,
      
      // Group info
      group_name: chat.is_group ? chat.group_name : null,
      sender_name: agentName, // O agente que enviou
      sender_phone: null, // Não aplicável para mensagens enviadas pela plataforma
      
      // Evolution data (null for platform-sent messages)
      evolution_data: null,
      
      // File URLs
      file_url: record.file_url || null,
      file_name: record.file_name || null,
      audio_url: audioUrl,
      image_url: imageUrl,
      video_url: videoUrl,
      document_url: documentUrl,
      
      // Supabase info
      supabase_url: Deno.env.get('SUPABASE_URL') || '',
      supabase_anon_key: Deno.env.get('SUPABASE_ANON_KEY') || '',
    };

    // Adicionar dados especiais baseado no tipo de mensagem
    const specialTypes = ['contact', 'location', 'pix'];
    if (specialTypes.includes(record.message_type) && record.content) {
      try {
        const parsedData = JSON.parse(record.content);
        console.log('[trigger-sent-webhooks] Parsed special data for type:', record.message_type);
        
        if (record.message_type === 'contact') {
          payload.contact_data = parsedData;
        } else if (record.message_type === 'location') {
          payload.location_data = parsedData;
        } else if (record.message_type === 'pix') {
          payload.pix_data = parsedData;
        }
      } catch (e) {
        console.log('[trigger-sent-webhooks] Could not parse special message data:', e);
      }
    }

    console.log('[trigger-sent-webhooks] Sending to', webhooks.length, 'webhook(s) with payload type:', record.message_type);

    // Enviar para cada webhook
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        console.log(`[trigger-sent-webhooks] Calling webhook: ${webhook.name} (${webhook.url})`);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(webhook.headers || {})
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        
        console.log(`[trigger-sent-webhooks] Webhook ${webhook.name} response:`, response.status, responseText);

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} - ${responseText}`);
        }

        return {
          webhook: webhook.name,
          status: response.status,
          response: responseText
        };
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`[trigger-sent-webhooks] Completed: ${successCount} success, ${failureCount} failed`);
    tempLog('FINISHED trigger-sent-webhooks. evolutionResult: ' + JSON.stringify(evolutionResult) + '. results: ' + results.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Message processed. Evolution: ${evolutionResult.success ? 'sent' : 'failed'}. Webhooks: ${successCount} success, ${failureCount} failed`,
        evolutionSent: evolutionResult.success,
        evolutionError: evolutionResult.error,
        webhookResults: results.map(r => ({
          status: r.status,
          reason: r.status === 'rejected' ? r.reason : undefined
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    tempLog('FATAL CATCH ERROR: ' + error?.message);
    console.error('[trigger-sent-webhooks] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
