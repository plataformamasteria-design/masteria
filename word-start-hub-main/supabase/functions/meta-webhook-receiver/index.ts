import { createClient } from 'npm:@supabase/supabase-js@2';
import { uploadToR2, isR2Configured } from '../_shared/r2-client.ts';

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
    const url = new URL(req.url);

    // ===================== WEBHOOK VERIFICATION (GET) =====================
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token && challenge) {
        console.log('[meta-webhook] Verification request received, token:', token);

        // Token format: vitta_meta_<org_id_first_8_chars>
        const orgIdPrefix = token.replace('vitta_meta_', '');

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id')
          .ilike('id', `${orgIdPrefix}%`)
          .limit(1);

        if (orgs && orgs.length > 0) {
          console.log('[meta-webhook] Verification successful for org:', orgs[0].id);
          return new Response(challenge, { status: 200 });
        }

        // Fallback: accept if token starts with vitta_meta (dev mode)
        if (token.startsWith('vitta_meta')) {
          console.log('[meta-webhook] Verification accepted (dev mode)');
          return new Response(challenge, { status: 200 });
        }

        return new Response('Verification failed', { status: 403 });
      }

      return new Response('OK', { status: 200 });
    }

    // ===================== WEBHOOK EVENT (POST) =====================
    const body = await req.json();
    console.log('[meta-webhook] ========== INCOMING EVENT ==========');
    console.log('[meta-webhook] Full payload:', JSON.stringify(body).slice(0, 1000));

    const object = body.object;
    console.log('[meta-webhook] Object type:', object);

    // ===================== WHATSAPP CLOUD API =====================
    if (object === 'whatsapp_business_account') {
      console.log('[meta-webhook] Processing WhatsApp Cloud API event');
      await processWhatsAppCloudWebhook(supabase, body);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (object !== 'page' && object !== 'instagram') {
      console.log('[meta-webhook] Ignoring unsupported event type:', object);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const entries = body.entry || [];
    console.log('[meta-webhook] Number of entries:', entries.length);

    for (const entry of entries) {
      const entryId = entry.id;
      const messaging = entry.messaging || [];
      console.log(`[meta-webhook] Entry ID: ${entryId}, messaging events: ${messaging.length}, object: ${object}`);

      // Try to find connection by multiple strategies
      let connection = null;
      let channel: 'facebook' | 'instagram' = object === 'instagram' ? 'instagram' : 'facebook';

      // Strategy 1: Lookup by page_id (works for Facebook Messenger)
      const { data: connByPage } = await supabase
        .from('meta_connections')
        .select('organization_id, page_id, page_name, page_access_token, instagram_business_account_id')
        .eq('page_id', entryId)
        .eq('is_active', true)
        .maybeSingle();

      if (connByPage) {
        connection = connByPage;
        console.log(`[meta-webhook] ✅ Found connection by page_id: ${connByPage.page_name} (org: ${connByPage.organization_id})`);
      }

      // Strategy 2: Lookup by instagram_business_account_id (works for IG DMs)
      if (!connection) {
        const { data: connByIg } = await supabase
          .from('meta_connections')
          .select('organization_id, page_id, page_name, page_access_token, instagram_business_account_id')
          .eq('instagram_business_account_id', entryId)
          .eq('is_active', true)
          .maybeSingle();

        if (connByIg) {
          connection = connByIg;
          channel = 'instagram';
          console.log(`[meta-webhook] ✅ Found connection by instagram_business_account_id: ${connByIg.page_name} (org: ${connByIg.organization_id})`);
        }
      }

      // Strategy 3: If object is 'instagram', try fetching ALL active connections
      // and match by checking if the entry sender/recipient matches a known IG account
      if (!connection && object === 'instagram') {
        console.log('[meta-webhook] ⚠️ Trying broad IG lookup for entryId:', entryId);
        const { data: allConns } = await supabase
          .from('meta_connections')
          .select('organization_id, page_id, page_name, page_access_token, instagram_business_account_id')
          .eq('is_active', true)
          .not('instagram_business_account_id', 'is', null);

        if (allConns && allConns.length > 0) {
          // Use the first connection that has an IG account
          connection = allConns[0];
          channel = 'instagram';
          console.log(`[meta-webhook] ⚠️ Using first active IG connection as fallback: ${connection.page_name} (org: ${connection.organization_id})`);

          // Also update the instagram_business_account_id to this entryId for future lookups
          await supabase
            .from('meta_connections')
            .update({ instagram_business_account_id: entryId })
            .eq('id', connection.organization_id)
            .eq('page_id', connection.page_id);
          console.log(`[meta-webhook] Updated IG account ID to ${entryId} for future lookups`);
        }
      }

      if (!connection) {
        console.error(`[meta-webhook] ❌ No connection found for entry ID: ${entryId} (object: ${object})`);
        // Log all active connections for debugging
        const { data: debugConns } = await supabase
          .from('meta_connections')
          .select('page_id, page_name, instagram_business_account_id, is_active')
          .eq('is_active', true);
        console.log('[meta-webhook] Active connections in DB:', JSON.stringify(debugConns));
        continue;
      }

      // Process each messaging event
      for (const event of messaging) {
        await processIncomingMessage(supabase, connection, event, channel);
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[meta-webhook] ❌ CRITICAL ERROR:', error);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});

/**
 * Downloads media from a URL and re-uploads it to Cloudflare R2.
 * Returns the R2 public URL or the original URL as fallback.
 */
async function persistMediaToR2(
  mediaUrl: string,
  fileName: string,
  contentType: string,
  organizationId: string
): Promise<string> {
  if (!isR2Configured()) {
    console.log('[meta-webhook] R2 not configured, keeping original Meta URL (will expire!)');
    return mediaUrl;
  }

  try {
    console.log(`[meta-webhook] 📥 Downloading media from Meta CDN: ${mediaUrl.slice(0, 80)}...`);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error(`[meta-webhook] Failed to download media: ${response.status}`);
      return mediaUrl;
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Build storage path: org_id/meta-media/timestamp-random.ext
    const ext = fileName.split('.').pop() || 'bin';
    const storagePath = `${organizationId}/meta-media/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const publicUrl = await uploadToR2(bytes, storagePath, contentType);
    if (publicUrl) {
      console.log(`[meta-webhook] ✅ Media persisted to R2: ${publicUrl}`);
      return publicUrl;
    }

    console.warn('[meta-webhook] R2 upload returned null, using original URL');
    return mediaUrl;
  } catch (e) {
    console.error('[meta-webhook] Error persisting media to R2:', e);
    return mediaUrl;
  }
}

async function processIncomingMessage(
  supabase: any,
  connection: any,
  event: any,
  channel: 'facebook' | 'instagram'
) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;
  const message = event.message;
  const read = event.read;
  const delivery = event.delivery;

  if (!senderId) {
    console.log('[meta-webhook] No sender ID in event, skipping');
    return;
  }

  console.log(`[meta-webhook] Processing ${channel} event - sender: ${senderId}, recipient: ${recipientId}`);

  // Skip if it's our own message (sent by the page or IG account)
  if (senderId === connection.page_id || senderId === connection.instagram_business_account_id) {
    console.log('[meta-webhook] Skipping own message (echo)');
    return;
  }

  const organizationId = connection.organization_id;

  // Handle message read events
  if (read) {
    console.log(`[meta-webhook] Message read event from ${senderId}`);
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date(read.watermark).toISOString() })
      .eq('organization_id', organizationId)
      .is('read_at', null)
      .eq('is_from_user', true);

    if (error) console.error('[meta-webhook] Error updating read status:', error);
    return;
  }

  // Handle delivery events
  if (delivery) {
    console.log(`[meta-webhook] Delivery event from ${senderId}`);
    const { error } = await supabase
      .from('messages')
      .update({ delivered_at: new Date(delivery.watermark).toISOString() })
      .eq('organization_id', organizationId)
      .is('delivered_at', null)
      .eq('is_from_user', true);

    if (error) console.error('[meta-webhook] Error updating delivery status:', error);
    return;
  }

  if (!message) {
    console.log('[meta-webhook] No message content in event, skipping');
    return;
  }

  console.log(`[meta-webhook] 📩 New ${channel} message from ${senderId}: "${(message.text || '').slice(0, 80)}"`);

  // Get sender profile info from Meta
  let senderName = senderId;
  try {
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=name,profile_pic&access_token=${connection.page_access_token}`
    );
    const profileData = await profileResponse.json();
    if (profileData.name) {
      senderName = profileData.name;
    }
    console.log(`[meta-webhook] Sender profile: ${senderName}`);
  } catch (e) {
    console.error('[meta-webhook] Error fetching sender profile:', e);
  }

  // Find or create chat
  const chatPhone = `${channel}:${senderId}`;

  let { data: chat } = await supabase
    .from('chats')
    .select('id')
    .eq('phone', chatPhone)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!chat) {
    // Create new chat
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({
        phone: chatPhone,
        organization_id: organizationId,
        wa_name: senderName,
        channel,
        last_message_at: new Date(timestamp).toISOString(),
      })
      .select('id')
      .single();

    if (chatError) {
      console.error('[meta-webhook] ❌ Error creating chat:', chatError);
      return;
    }
    chat = newChat;
    console.log(`[meta-webhook] ✅ Created new ${channel} chat: ${chat.id}`);
  }

  // Determine message type and content, persist media to R2
  let messageType = 'text';
  let content = message.text || '';
  let fileUrl: string | null = null;
  let fileName: string | null = null;

  if (message.attachments?.length > 0) {
    const attachment = message.attachments[0];
    const type = attachment.type;
    const payload = attachment.payload;

    if (type === 'image') {
      messageType = 'image';
      fileName = 'image.jpg';
      if (payload?.url) {
        fileUrl = await persistMediaToR2(payload.url, fileName, 'image/jpeg', organizationId);
      }
    } else if (type === 'video') {
      messageType = 'video';
      fileName = 'video.mp4';
      if (payload?.url) {
        fileUrl = await persistMediaToR2(payload.url, fileName, 'video/mp4', organizationId);
      }
    } else if (type === 'audio') {
      messageType = 'audio';
      fileName = 'audio.mp3';
      if (payload?.url) {
        fileUrl = await persistMediaToR2(payload.url, fileName, 'audio/mpeg', organizationId);
      }
    } else if (type === 'file') {
      messageType = 'document';
      fileName = payload?.name || 'document';
      if (payload?.url) {
        fileUrl = await persistMediaToR2(payload.url, fileName, 'application/octet-stream', organizationId);
      }
    } else if (type === 'location') {
      messageType = 'text';
      content = `📍 Localização: ${payload?.coordinates?.lat}, ${payload?.coordinates?.long}`;
    } else if (type === 'share' || type === 'story_mention') {
      // Instagram story mentions and shared posts
      messageType = 'text';
      content = message.text || `📎 ${type === 'story_mention' ? 'Mencionou você nos stories' : 'Compartilhou um post'}`;
      if (payload?.url) {
        fileUrl = await persistMediaToR2(payload.url, 'shared.jpg', 'image/jpeg', organizationId);
        messageType = 'image';
      }
    }
  }

  // Insert message
  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      chat_id: chat.id,
      organization_id: organizationId,
      content,
      message_type: messageType,
      is_from_user: false, // Incoming from customer
      file_url: fileUrl,
      file_name: fileName,
      meta_message_id: message.mid || null,
      sender_name: senderName,
      created_at: new Date(timestamp).toISOString(),
    });

  if (msgError) {
    console.error('[meta-webhook] ❌ Error inserting message:', msgError);
    return;
  }

  // Update chat last_message
  await supabase
    .from('chats')
    .update({
      last_message: content || `📎 ${messageType}`,
      last_message_at: new Date(timestamp).toISOString(),
      last_inbound_at: new Date(timestamp).toISOString(),
      hidden_from_chat: false,
    })
    .eq('id', chat.id);

  console.log(`[meta-webhook] ✅ Message stored for chat ${chat.id} (${channel})`);

  // Trigger automations or resume waiting flows
  await processAutomationsOnMessage(supabase, chat.id, organizationId);
}

/**
 * Process WhatsApp Cloud API webhook events.
 * Payload structure is very different from Instagram/Messenger.
 */
async function processWhatsAppCloudWebhook(supabase: any, body: any) {
  const entries = body.entry || [];
  console.log(`[wa-cloud] Processing ${entries.length} entries`);

  for (const entry of entries) {
    const wabaId = entry.id; // WhatsApp Business Account ID
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== 'messages') {
        console.log(`[wa-cloud] Skipping field: ${change.field}`);
        continue;
      }

      const value = change.value;
      if (!value) continue;

      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id;
      const displayPhone = metadata.display_phone_number;

      console.log(`[wa-cloud] WABA: ${wabaId}, Phone Number ID: ${phoneNumberId}, Display: ${displayPhone}`);

      // Find organization by matching WABA ID or Phone Number ID in org settings
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, settings')
        .or(`settings->>whatsapp_cloud_waba_id.eq.${wabaId},settings->>whatsapp_cloud_phone_number_id.eq.${phoneNumberId}`);

      let orgId: string | null = null;
      let accessToken: string | null = null;

      if (orgs && orgs.length > 0) {
        orgId = orgs[0].id;
        accessToken = orgs[0].settings?.whatsapp_cloud_access_token || null;
        console.log(`[wa-cloud] ✅ Found org: ${orgs[0].name} (${orgId})`);
      } else {
        // Fallback: scan all orgs with whatsapp_cloud settings
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id, name, settings')
          .not('settings->whatsapp_cloud_waba_id', 'is', null);

        if (allOrgs) {
          for (const org of allOrgs) {
            const s = org.settings || {};
            if (s.whatsapp_cloud_waba_id === wabaId || s.whatsapp_cloud_phone_number_id === phoneNumberId) {
              orgId = org.id;
              accessToken = s.whatsapp_cloud_access_token || null;
              console.log(`[wa-cloud] ✅ Found org via manual scan: ${org.name}`);
              break;
            }
          }
        }
      }

      if (!orgId) {
        console.error(`[wa-cloud] ❌ No org found for WABA ${wabaId} / Phone ${phoneNumberId}`);
        continue;
      }

      // Process status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        console.log(`[wa-cloud] Status update: ${status.status} for message ${status.id}`);
        if (status.status === 'delivered') {
          await supabase
            .from('messages')
            .update({ delivered_at: new Date(parseInt(status.timestamp) * 1000).toISOString() })
            .eq('meta_message_id', status.id);
        } else if (status.status === 'read') {
          await supabase
            .from('messages')
            .update({ read_at: new Date(parseInt(status.timestamp) * 1000).toISOString() })
            .eq('meta_message_id', status.id);
        }
      }

      // Process incoming messages
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const msg of messages) {
        const senderPhone = msg.from;
        const senderProfile = contacts.find((c: any) => c.wa_id === senderPhone);
        const senderName = senderProfile?.profile?.name || senderPhone;
        const timestamp = parseInt(msg.timestamp) * 1000;

        console.log(`[wa-cloud] 📩 Message from ${senderName} (${senderPhone}): type=${msg.type}`);

        // Find or create chat
        const chatPhone = `whatsapp_cloud:${senderPhone}`;

        let { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', chatPhone)
          .eq('organization_id', orgId)
          .maybeSingle();

        if (!chat) {
          const { data: newChat, error: chatError } = await supabase
            .from('chats')
            .insert({
              phone: chatPhone,
              organization_id: orgId,
              wa_name: senderName,
              channel: 'whatsapp_cloud',
              last_message_at: new Date(timestamp).toISOString(),
            })
            .select('id')
            .single();

          if (chatError) {
            console.error('[wa-cloud] ❌ Error creating chat:', chatError);
            continue;
          }
          chat = newChat;
          console.log(`[wa-cloud] ✅ Created new chat: ${chat.id}`);
        }

        // Parse message content
        let messageType = 'text';
        let content = '';
        let fileUrl: string | null = null;
        let fileName: string | null = null;

        if (msg.type === 'text') {
          content = msg.text?.body || '';
        } else if (msg.type === 'image') {
          messageType = 'image';
          content = msg.image?.caption || '';
          if (msg.image?.id && accessToken) {
            fileUrl = await downloadAndPersistWaMedia(msg.image.id, accessToken, 'image.jpg', 'image/jpeg', orgId);
          }
          fileName = 'image.jpg';
        } else if (msg.type === 'video') {
          messageType = 'video';
          content = msg.video?.caption || '';
          if (msg.video?.id && accessToken) {
            fileUrl = await downloadAndPersistWaMedia(msg.video.id, accessToken, 'video.mp4', 'video/mp4', orgId);
          }
          fileName = 'video.mp4';
        } else if (msg.type === 'audio') {
          messageType = 'audio';
          if (msg.audio?.id && accessToken) {
            fileUrl = await downloadAndPersistWaMedia(msg.audio.id, accessToken, 'audio.ogg', 'audio/ogg', orgId);
          }
          fileName = 'audio.ogg';
        } else if (msg.type === 'document') {
          messageType = 'document';
          content = msg.document?.caption || '';
          fileName = msg.document?.filename || 'document';
          if (msg.document?.id && accessToken) {
            fileUrl = await downloadAndPersistWaMedia(msg.document.id, accessToken, fileName, 'application/octet-stream', orgId);
          }
        } else if (msg.type === 'sticker') {
          messageType = 'image';
          if (msg.sticker?.id && accessToken) {
            fileUrl = await downloadAndPersistWaMedia(msg.sticker.id, accessToken, 'sticker.webp', 'image/webp', orgId);
          }
          fileName = 'sticker.webp';
        } else if (msg.type === 'location') {
          messageType = 'text';
          content = `📍 Localização: ${msg.location?.latitude}, ${msg.location?.longitude}`;
          if (msg.location?.name) content += ` - ${msg.location.name}`;
        } else if (msg.type === 'contacts') {
          messageType = 'text';
          const contact = msg.contacts?.[0];
          content = `👤 Contato: ${contact?.name?.formatted_name || 'Desconhecido'}`;
          if (contact?.phones?.[0]?.phone) content += ` - ${contact.phones[0].phone}`;
        } else if (msg.type === 'reaction') {
          console.log(`[wa-cloud] Reaction: ${msg.reaction?.emoji} on ${msg.reaction?.message_id}`);
          continue; // Skip reactions for now
        } else {
          content = `[${msg.type}]`;
        }

        // Insert message
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            chat_id: chat.id,
            organization_id: orgId,
            content,
            message_type: messageType,
            is_from_user: false,
            file_url: fileUrl,
            file_name: fileName,
            meta_message_id: msg.id || null,
            sender_name: senderName,
            created_at: new Date(timestamp).toISOString(),
          });

        if (msgError) {
          console.error('[wa-cloud] ❌ Error inserting message:', msgError);
          continue;
        }

        // Update chat
        await supabase
          .from('chats')
          .update({
            last_message: content || `📎 ${messageType}`,
            last_message_at: new Date(timestamp).toISOString(),
            last_inbound_at: new Date(timestamp).toISOString(),
            hidden_from_chat: false,
            wa_name: senderName,
          })
          .eq('id', chat.id);

        console.log(`[wa-cloud] ✅ Message stored for chat ${chat.id}`);

        await processAutomationsOnMessage(supabase, chat.id, orgId);
      }
    }
  }
}

/**
 * Download WhatsApp Cloud media (by media ID) and persist to R2.
 * WhatsApp Cloud requires a two-step process:
 * 1. GET /{media_id} to get the download URL
 * 2. GET the download URL with auth header to get the bytes
 */
async function downloadAndPersistWaMedia(
  mediaId: string,
  accessToken: string,
  fileName: string,
  contentType: string,
  organizationId: string
): Promise<string | null> {
  try {
    // Step 1: Get media URL
    console.log(`[wa-cloud] 📥 Getting media URL for ${mediaId}`);
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      console.error(`[wa-cloud] Failed to get media URL: ${metaResponse.status}`);
      return null;
    }

    const metaData = await metaResponse.json();
    const downloadUrl = metaData.url;
    if (!downloadUrl) {
      console.error('[wa-cloud] No download URL in media response');
      return null;
    }

    // Step 2: Download media bytes
    const mediaResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaResponse.ok) {
      console.error(`[wa-cloud] Failed to download media: ${mediaResponse.status}`);
      return null;
    }

    const buffer = await mediaResponse.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Step 3: Upload to R2
    if (!isR2Configured()) {
      console.log('[wa-cloud] R2 not configured, no persistent URL available');
      return null;
    }

    const ext = fileName.split('.').pop() || 'bin';
    const storagePath = `${organizationId}/wa-cloud-media/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const publicUrl = await uploadToR2(bytes, storagePath, contentType);

    if (publicUrl) {
      console.log(`[wa-cloud] ✅ Media persisted to R2: ${publicUrl}`);
      return publicUrl;
    }

    return null;
  } catch (e) {
    console.error('[wa-cloud] Error downloading/persisting media:', e);
    return null;
  }
}

/**
 * Executes automations for inbound messages (resuming waiting flows and triggering message_received flows).
 */
async function processAutomationsOnMessage(supabase: any, chatId: string, organizationId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Resume waiting automations
    const { data: waitingExecs } = await supabase
      .from('automation_executions')
      .select('id, context, status')
      .eq('chat_id', chatId)
      .eq('organization_id', organizationId)
      .in('status', ['waiting_response']);

    const resumedExecutionIds = new Set<string>();
    const resumedAutomationIds = new Set<string>();

    if (waitingExecs && waitingExecs.length > 0) {
      for (const exec of waitingExecs) {
        // Change status back to running
        await supabase.from('automation_executions')
          .update({ status: 'running' })
          .eq('id', exec.id);

        resumedExecutionIds.add(exec.id);
        resumedAutomationIds.add(exec.context?.automation_id || 'unknown');

        const nextNodes = exec.context?.waiting_nodes || [];

        fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            resume_execution_id: exec.id,
            trigger_type: 'resume',
            chat_id: chatId,
            organization_id: organizationId,
            start_from_nodes: nextNodes
          })
        }).catch(e => console.error("[meta-webhook] Error resuming auto:", e));
      }
    }

    // 2. Trigger message_received automations
    const { data: chatStages } = await supabase
      .from('chat_funnel_stage')
      .select('stage_id, funnel_id')
      .eq('chat_id', chatId)
      .eq('organization_id', organizationId);

    if (chatStages && chatStages.length > 0) {
      const stageIds = chatStages.map((cs: any) => cs.stage_id);
      const funnelIds = chatStages.map((cs: any) => cs.funnel_id);

      const { data: msgAutomations } = await supabase
        .from('automations')
        .select('id, trigger_stage_id, funnel_id')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .eq('trigger_type', 'message_received')
        .in('funnel_id', funnelIds);

      if (msgAutomations && msgAutomations.length > 0) {
        for (const auto of msgAutomations) {
          if (resumedAutomationIds.has(auto.id)) continue; // skip if we just resumed this exact same automation
          if (auto.trigger_stage_id && !stageIds.includes(auto.trigger_stage_id)) continue;

          const matchingStage = chatStages.find((cs: any) => cs.funnel_id === auto.funnel_id && (!auto.trigger_stage_id || cs.stage_id === auto.trigger_stage_id));

          fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              trigger_type: 'message_received',
              chat_id: chatId,
              stage_id: matchingStage?.stage_id || null,
              funnel_id: auto.funnel_id,
              organization_id: organizationId,
              automation_id: auto.id,
            })
          }).catch(e => console.error("[meta-webhook] Error triggering message_received:", e));
        }
      }
    }
  } catch (err) {
    console.error("[meta-webhook] Error processing automations on message:", err);
  }
}
