import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Get Evolution API config for an organization (same logic as send-to-evolution)
 */
async function getEvolutionConfig(supabase: any, orgId: string, overrideInstanceName?: string | null) {
  const { data: org } = await supabase
    .from("organizations")
    .select("slug, instance_name, evolution_api_url, evolution_api_key")
    .eq("id", orgId)
    .single();

  if (!org) return null;

  // Get global config as fallback
  const { data: globalConfig } = await supabase
    .from("global_config")
    .select("key, value")
    .in("key", ["evolution_api_url", "evolution_api_key"]);

  const globalUrl = globalConfig?.find((c: any) => c.key === "evolution_api_url")?.value;
  const globalKey = globalConfig?.find((c: any) => c.key === "evolution_api_key")?.value;

  const isValidUrl = (v: string | null) => !!v && (v.startsWith("http://") || v.startsWith("https://"));
  const isValidKey = (v: string | null) => !!v && !v.includes("http") && v.length > 10;

  const evolutionUrl = isValidUrl(org.evolution_api_url) ? org.evolution_api_url : isValidUrl(globalUrl) ? globalUrl : null;
  const evolutionKey = isValidKey(org.evolution_api_key) ? org.evolution_api_key : isValidKey(globalKey) ? globalKey : null;

  if (!evolutionUrl || !evolutionKey) return null;

  let cleanUrl = evolutionUrl.replace(/\/$/, "").replace(/\/manager\/?$/, "").replace(/\/api\/?$/, "");
  
  // Ignore generic channel names as instance overrides
  const genericChannels = ['whatsapp', 'evolution', 'whatsapp_cloud', 'facebook', 'instagram'];
  const validOverride = overrideInstanceName && !genericChannels.includes(overrideInstanceName.toLowerCase())
    ? overrideInstanceName
    : null;

  // [BUG-5 FIX] If no valid override (channel), prefer the default whatsapp_connection's
  // instance_name over organizations.instance_name (legacy field) for multi-connection orgs.
  let instanceName: string;
  if (validOverride) {
    instanceName = validOverride;
  } else {
    const { data: defaultConn } = await supabase
      .from("whatsapp_connections")
      .select("instance_name")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .maybeSingle();
    instanceName = defaultConn?.instance_name || org.instance_name || org.slug;
  }

  return { url: cleanUrl, apiKey: evolutionKey, instanceName };
}

/**
 * Send a text message to WhatsApp via Evolution API.
 * [BUG-2+4 FIX] Returns { ok, externalId } so caller can persist external_message_id.
 */
async function sendToWhatsApp(
  supabase: any,
  orgId: string,
  phone: string,
  content: string,
  channel: string | null
): Promise<{ ok: boolean; externalId: string | null }> {
  const config = await getEvolutionConfig(supabase, orgId, channel);
  if (!config) {
    console.error("[ghl-webhook] No Evolution API config found for org:", orgId);
    return { ok: false, externalId: null };
  }

  try {
    const formattedPhone = phone.replace(/\D/g, "");
    console.log(`[ghl-webhook] Sending to WhatsApp via Evolution: ${formattedPhone} (instance: ${config.instanceName})`);

    const response = await fetch(
      `${config.url}/message/sendText/${config.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: content,
        }),
      }
    );

    const responseData = await response.json();
    console.log(`[ghl-webhook] Evolution response:`, response.status, JSON.stringify(responseData).substring(0, 200));

    // Extract external ID from Evolution response (needed for echo deduplication)
    const externalId: string | null =
      responseData?.key?.id ??
      responseData?.message?.key?.id ??
      responseData?.data?.key?.id ??
      responseData?.messageId ??
      responseData?.id ??
      null;

    return { ok: response.ok, externalId };
  } catch (err) {
    console.error("[ghl-webhook] Error sending to Evolution:", err);
    return { ok: false, externalId: null };
  }
}

/**
 * Send a media message to WhatsApp via Evolution API
 * [BUG-2+4 FIX] Returns { ok, externalId } so caller can persist external_message_id.
 */
async function sendToWhatsAppMedia(
  supabase: any,
  orgId: string,
  phone: string,
  fileUrl: string,
  fileName: string | null,
  caption: string | undefined,
  channel: string | null
): Promise<{ ok: boolean; externalId: string | null }> {
  const config = await getEvolutionConfig(supabase, orgId, channel);
  if (!config) return { ok: false, externalId: null };

  try {
    const formattedPhone = phone.replace(/\D/g, "");
    console.log(`[ghl-webhook] Sending MEDIA to WhatsApp: ${formattedPhone} (url: ${fileUrl})`);

    const extension = fileUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'oga'];
    const imageExts = ['jpg', 'jpeg', 'png', 'webp'];
    const videoExts = ['mp4', 'avi', 'mov'];

    let endpoint = 'sendDocument';
    let payload: any = { number: formattedPhone, document: fileUrl, fileName: fileName || 'file.pdf' };
    if (caption) payload.caption = caption;

    if (audioExts.includes(extension)) {
      endpoint = 'sendWhatsAppAudio';
      payload = { number: formattedPhone, audio: fileUrl };
    } else if (imageExts.includes(extension)) {
      endpoint = 'sendMedia';
      payload = { number: formattedPhone, mediatype: 'image', media: fileUrl, mimetype: 'image/jpeg' };
      if (caption) payload.caption = caption;
    } else if (videoExts.includes(extension)) {
      endpoint = 'sendMedia';
      payload = { number: formattedPhone, mediatype: 'video', media: fileUrl };
      if (caption) payload.caption = caption;
    }

    const response = await fetch(`${config.url}/message/${endpoint}/${config.instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.apiKey },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log(`[ghl-webhook] Evolution media response:`, response.status, JSON.stringify(responseData).substring(0, 200));

    const externalId: string | null =
      responseData?.key?.id ??
      responseData?.message?.key?.id ??
      responseData?.data?.key?.id ??
      responseData?.messageId ??
      responseData?.id ??
      null;

    return { ok: response.ok, externalId };
  } catch (err) {
    console.error("[ghl-webhook] Error sending media:", err);
    return { ok: false, externalId: null };
  }
}

/**
 * Normalize phone number - strip non-digits
 */
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Find or create a chat for a contact, and ensure GHL mapping exists.
 * Uses upsert logic to prevent race-condition duplicates.
 */
async function findOrCreateChat(
  supabase: any,
  orgId: string,
  ghlContactId: string,
  phone: string,
  name?: string,
  assignedToGhlUserId?: string
): Promise<string | null> {
  if (!phone) return null;

  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;

  // Check existing mapping first
  const { data: existing } = await supabase
    .from("ghl_sync_mappings")
    .select("vitta_id")
    .eq("organization_id", orgId)
    .eq("resource_type", "contact")
    .eq("ghl_id", ghlContactId)
    .maybeSingle();

  if (existing?.vitta_id) return existing.vitta_id;

  // Try to find chat by phone — use limit(1) instead of maybeSingle to be safe
  // in case a race condition already created a duplicate (the unique index will prevent new ones)
  const { data: existingChats } = await supabase
    .from("chats")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: true })
    .limit(1);

  const existingChat = existingChats?.[0] ?? null;

  let chatId = null;

  if (existingChat) {
    // Create mapping for existing chat — upsert to avoid duplicate mapping errors
    await supabase.from("ghl_sync_mappings").upsert(
      {
        organization_id: orgId,
        resource_type: "contact",
        vitta_id: existingChat.id,
        ghl_id: ghlContactId,
      },
      { onConflict: "organization_id,resource_type,ghl_id" }
    );
    chatId = existingChat.id;
  } else {
    // [FIX-4] Use the default whatsapp_connection's instance_name as channel.
    // Previously used organizations.instance_name (legacy field) which does NOT match
    // newer connections created with pattern "${slug}_${timestamp}".
    // Now we prioritise the is_default connection's instance_name for consistency.
    const { data: defaultConn } = await supabase
      .from("whatsapp_connections")
      .select("instance_name")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .maybeSingle();

    // Fallback chain: default connection → org legacy field → org slug → hardcoded
    let channelName: string;
    if (defaultConn?.instance_name) {
      channelName = defaultConn.instance_name;
    } else {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("instance_name, slug")
        .eq("id", orgId)
        .maybeSingle();
      channelName = orgData?.instance_name || orgData?.slug || "whatsapp";
    }

    // Insert new chat — catch handles race-condition duplicates
    const { data: newChat, error: upsertErr } = await supabase
      .from("chats")
      .insert({
          organization_id: orgId,
          phone: cleanPhone,
          wa_name: name || cleanPhone,
          custom_name: name || null,
          channel: channelName,
      })
      .select("id")
      .maybeSingle();

    if (upsertErr) {
      console.error("[ghl-webhook] Error upserting chat:", upsertErr);
      // Fallback: try to fetch the chat that triggered the conflict
      const { data: conflictChat } = await supabase
        .from("chats")
        .select("id")
        .eq("organization_id", orgId)
        .eq("phone", cleanPhone)
        .eq("channel", channelName)
        .limit(1)
        .maybeSingle();

      if (conflictChat) chatId = conflictChat.id;
    } else if (newChat) {
      await supabase.from("ghl_sync_mappings").upsert(
        {
          organization_id: orgId,
          resource_type: "contact",
          vitta_id: newChat.id,
          ghl_id: ghlContactId,
        },
        { onConflict: "organization_id,resource_type,ghl_id" }
      );
      chatId = newChat.id;
    }
  }

  // Handle assigned agent synchronization
  if (chatId && assignedToGhlUserId) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", orgId)
        .eq("ghl_user_id", assignedToGhlUserId)
        .maybeSingle();

      if (profile?.id) {
        await supabase
          .from("chats")
          .update({
            assigned_to: profile.id,
            assigned_at: new Date().toISOString()
          })
          .eq("id", chatId);

        console.log(`[ghl-webhook] Assigned chat ${chatId} to agent ${profile.id} based on GHL assignedTo`);
      }
    } catch (err) {
      console.error("[ghl-webhook] Error assigning to agent:", err);
    }
  }

  return chatId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const eventType = body.type || body.event;

    console.log("[ghl-webhook] Received:", eventType, JSON.stringify(body).slice(0, 800));

    // Determine organization from locationId
    const locationId =
      body.locationId ||
      body.location_id ||
      body.location?.id ||
      body.data?.locationId ||
      body.data?.location_id ||
      body.payload?.locationId ||
      body.payload?.location_id;

    if (!locationId) {
      console.error("[ghl-webhook] No locationId found in payload");
      return new Response(
        JSON.stringify({ ok: false, error: "No locationId in webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connection } = await supabase
      .from("ghl_connections")
      .select("organization_id")
      .eq("location_id", locationId)
      .single();

    if (!connection) {
      console.log("[ghl-webhook] No connection found for locationId:", locationId);
      return new Response(
        JSON.stringify({ ok: false, error: "Unknown location" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = connection.organization_id;
    console.log("[ghl-webhook] Matched org:", orgId);

    // Handle different event types
    switch (eventType) {
      case "ContactCreate":
      case "ContactUpdate": {
        // GHL sends contact data at root or in body directly
        const contact = body.data || body.payload || body;
        const contactId = contact.id || contact.contactId;
        const phone = normalizePhone(
          contact.phone || contact.phoneNumber || contact.mobile
        );
        const contactName =
          contact.name ||
          contact.contactName ||
          `${contact.firstName || ""} ${contact.lastName || ""}`.trim();

        console.log("[ghl-webhook] Contact event:", { contactId, phone, contactName });

        if (!phone || !contactId) {
          console.log("[ghl-webhook] Missing phone or contactId, skipping");
          break;
        }

        const assignedTo = contact.assignedTo || contact.assigned_to;

        await findOrCreateChat(supabase, orgId, contactId, phone, contactName || undefined, assignedTo);
        break;
      }

      case "OpportunityCreate":
      case "OpportunityStageUpdate": {
        const opp = body.data || body.payload || body;
        if (opp.pipelineId && opp.pipelineStageId && opp.contactId) {
          const { data: pipelineMapping } = await supabase
            .from("ghl_sync_mappings")
            .select("vitta_id")
            .eq("organization_id", orgId)
            .eq("resource_type", "pipeline")
            .eq("ghl_id", opp.pipelineId)
            .maybeSingle();

          const { data: stageMapping } = await supabase
            .from("ghl_sync_mappings")
            .select("vitta_id")
            .eq("organization_id", orgId)
            .eq("resource_type", "stage")
            .eq("ghl_id", opp.pipelineStageId)
            .maybeSingle();

          const { data: contactMapping } = await supabase
            .from("ghl_sync_mappings")
            .select("vitta_id")
            .eq("organization_id", orgId)
            .eq("resource_type", "contact")
            .eq("ghl_id", opp.contactId)
            .maybeSingle();

          if (pipelineMapping && stageMapping && contactMapping) {
            await supabase
              .from("chat_funnel_stage")
              .upsert(
                {
                  organization_id: orgId,
                  chat_id: contactMapping.vitta_id,
                  funnel_id: pipelineMapping.vitta_id,
                  stage_id: stageMapping.vitta_id,
                  moved_at: new Date().toISOString(),
                  sync_source: "ghl",
                },
                { onConflict: "chat_id,funnel_id" }
              );
          }
        }
        break;
      }

      case "InboundMessage": {
        // [FIX-4] Process GHL InboundMessage for non-WhatsApp channels.
        // WhatsApp messages already arrive via Evolution webhook, so we only handle
        // SMS, Email, Live Chat, and other GHL-native channels here.
        const inMsg = body.data || body.payload || body;
        const inMsgType = inMsg.type || inMsg.messageType || body.type || "";
        const inMsgPhone = normalizePhone(inMsg.phone || inMsg.from || inMsg.contactPhone || body.phone);
        const inContactId = inMsg.contactId || inMsg.contact_id || body.contactId;
        const inMsgBody = inMsg.body || inMsg.message || inMsg.text || body.message || "";
        const inMsgId = inMsg.messageId || inMsg.id || body.messageId;

        // Skip WhatsApp inbound — those already arrive via Evolution API webhook
        const isWhatsAppChannel = ["whatsapp", "WhatsApp", "WHATSAPP"].includes(String(inMsgType));
        if (isWhatsAppChannel) {
          console.log("[ghl-webhook] InboundMessage skipped — WhatsApp (already arrives via Evolution)");
          break;
        }

        if (!inContactId || (!inMsgBody && !inMsgPhone)) {
          console.log("[ghl-webhook] InboundMessage missing contactId or content, skipping");
          break;
        }

        console.log("[ghl-webhook] Processing non-WhatsApp InboundMessage:", { inMsgType, inContactId, inMsgPhone, preview: inMsgBody?.substring(0, 80) });

        // Resolve or create the Vitta chat for this contact
        let inChatId: string | null = null;
        const { data: inContactMap } = await supabase
          .from("ghl_sync_mappings")
          .select("vitta_id")
          .eq("organization_id", orgId)
          .eq("resource_type", "contact")
          .eq("ghl_id", inContactId)
          .maybeSingle();

        inChatId = inContactMap?.vitta_id ?? null;

        if (!inChatId && inMsgPhone) {
          inChatId = await findOrCreateChat(
            supabase, orgId, inContactId, inMsgPhone,
            inMsg.contactName || inMsg.name || undefined
          );
        }

        if (!inChatId) {
          console.log("[ghl-webhook] InboundMessage: could not resolve chat for contact:", inContactId);
          break;
        }

        // [FIX-3] Dedup: check by external_message_id
        if (inMsgId) {
          const { data: dupCheck } = await supabase
            .from("messages")
            .select("id")
            .eq("chat_id", inChatId)
            .eq("organization_id", orgId)
            .eq("external_message_id", inMsgId)
            .maybeSingle();
          if (dupCheck) {
            console.log("[ghl-webhook] InboundMessage already recorded, skipping:", inMsgId);
            break;
          }
        }

        // Save inbound message from lead (is_from_user=false) with sync_source='ghl'
        const { error: inInsertErr } = await supabase.from("messages").insert({
          chat_id: inChatId,
          organization_id: orgId,
          content: inMsgBody || `[${inMsgType}]`,
          message_type: "text",
          is_from_user: false, // From the LEAD
          sync_source: "ghl",
          external_message_id: inMsgId || null,
          created_at: new Date().toISOString(),
          sent_from_platform: false,
        });

        if (inInsertErr) {
          if (inInsertErr.code === "23505") {
            console.log("[ghl-webhook] InboundMessage duplicate caught by DB constraint, skipping:", inMsgId);
          } else {
            console.error("[ghl-webhook] Error saving InboundMessage:", inInsertErr);
          }
        } else {
          console.log("[ghl-webhook] InboundMessage saved to Vitta from channel:", inMsgType);
        }
        break;
      }

      case "OutboundMessage":
      case "SMS":
      case "Custom":
      case "Email":
      case "WhatsApp":
      case "Live_Chat":
      case "FB":
      case "IG": {
        // ALL messages from GHL (except explicit InboundMessage) are outbound
        // This covers: human agents (has userId), AI bots (no userId), automations
        // Lead inbound messages already come through Evolution webhook
        const msg = body.data || body.payload || body;
        const contactId = msg.contactId || msg.contact_id || body.contactId;
        const messageBody =
          msg.body ||
          msg.message ||
          msg.text ||
          msg.messageBody ||
          msg.payload?.body ||
          body.message ||
          "";

        const attachments = msg.attachments || body.attachments || msg.payload?.attachments || [];
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

        console.log("[ghl-webhook] Outbound message event:", {
          eventType,
          contactId,
          hasUserId: !!(body.userId || msg.userId),
          hasBody: !!messageBody,
          hasAttachments,
          bodyPreview: messageBody?.substring(0, 100),
        });

        if (!contactId || (!messageBody && !hasAttachments)) {
          console.log("[ghl-webhook] Missing contactId or message content, skipping");
          break;
        }

        // Find the mapped chat
        const { data: contactMap } = await supabase
          .from("ghl_sync_mappings")
          .select("vitta_id")
          .eq("organization_id", orgId)
          .eq("resource_type", "contact")
          .eq("ghl_id", contactId)
          .maybeSingle();

        let chatId = contactMap?.vitta_id;

        if (!chatId) {
          console.log("[ghl-webhook] No contact mapping found, attempting phone lookup");
          const msgPhone = normalizePhone(
            msg.phone || msg.from || msg.to || msg.contactPhone || body.phone
          );
          if (msgPhone) {
            chatId = await findOrCreateChat(
              supabase, orgId, contactId, msgPhone,
              msg.contactName || msg.name || undefined
            );
          }
        }

        if (!chatId) {
          console.log("[ghl-webhook] Could not resolve chat for contact:", contactId);
          break;
        }

        // Deduplication check
        const messageIdempotencyKey = msg.messageId || msg.id || body.messageId;
        if (messageIdempotencyKey) {
          const { data: existingMsg } = await supabase
            .from("messages")
            .select("id")
            .eq("chat_id", chatId)
            .eq("organization_id", orgId)
            .eq("external_message_id", messageIdempotencyKey)
            .maybeSingle();

          if (existingMsg) {
            console.log("[ghl-webhook] Message already exists, skipping:", messageIdempotencyKey);
            break;
          }
        }

        // [FIX-3] Enhanced anti-loop protection: check dedup by both external_message_id (above)
        // AND by content + sync_source='ghl' within 30 seconds.
        // This covers cases where sync_source was not saved but content matches.
        const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
        
        let isDuplicateEcho = false;

        // Check text/content match
        if (messageBody) {
          const { data: recentDupeText } = await supabase
            .from("messages")
            .select("id")
            .eq("chat_id", chatId)
            .eq("organization_id", orgId)
            .eq("content", messageBody)
            .eq("is_from_user", true)
            .gte("created_at", thirtySecsAgo)
            .maybeSingle();
            
          if (recentDupeText) {
             isDuplicateEcho = true;
          }
        }

        // Check media echo (media without caption from Vitta has empty messageBody in GHL webhook)
        if (!isDuplicateEcho && hasAttachments) {
           const { data: recentMediaMsgs } = await supabase
            .from("messages")
            .select("id, sync_source")
            .eq("chat_id", chatId)
            .eq("organization_id", orgId)
            .eq("is_from_user", true)
            .not("file_url", "is", null)
            .gte("created_at", thirtySecsAgo)
            .limit(5);
            
           // If any recent media message did NOT originate from GHL, this webhook is highly likely an echo of it.
           if (recentMediaMsgs && recentMediaMsgs.some((m: any) => m.sync_source !== 'ghl')) {
               isDuplicateEcho = true;
           }
        }

        if (isDuplicateEcho) {
          console.log("[ghl-webhook] [FIX-3] Duplicate outbound message detected by content/media+30s check, skipping");
          break;
        }

        // Additional dedup: verify this exact external_message_id was not received via sync_source='ghl'
        // This catches the case where Evolution re-delivers a GHL-originated message
        if (messageIdempotencyKey) {
          const { data: syncSourceDup } = await supabase
            .from("messages")
            .select("id")
            .eq("organization_id", orgId)
            .eq("sync_source", "ghl")
            .eq("external_message_id", messageIdempotencyKey)
            .maybeSingle();
          if (syncSourceDup) {
            console.log("[ghl-webhook] [FIX-3] Message already exists with sync_source=ghl, skipping loop:", messageIdempotencyKey);
            break;
          }
        }

        // Check if this is an AI/bot message (no userId = bot/automation)
        const isFromHumanAgent = !!(body.userId || (body.data || body.payload || body).userId);
        const sentByGhlUserId = body.userId || (body.data || body.payload || body).userId;

        // Auto-assign chat if we know who sent the message
        // [FIX-1+3] Two-stage lookup:
        //   1st: profiles.ghl_user_id (populated via SSO iFrame login)
        //   2nd: whatsapp_connections.ghl_user_id (manual config by admin in UI)
        // This ensures agents who never used SSO still get chats assigned correctly.
        if (sentByGhlUserId && chatId) {
          try {
            let assignedProfileId: string | null = null;

            // Stage 1: SSO-based lookup
            const { data: profileBySSO } = await supabase
              .from("profiles")
              .select("id")
              .eq("organization_id", orgId)
              .eq("ghl_user_id", sentByGhlUserId)
              .maybeSingle();

            if (profileBySSO?.id) {
              assignedProfileId = profileBySSO.id;
              console.log("[ghl-webhook] Found agent via SSO profile:", assignedProfileId);
            } else {
              // Stage 2: manual config in whatsapp_connections
              // The admin mapped a ghl_user_id to a connection. Find which connection
              // has this ghl_user_id and use its assigned_user_id as fallback.
              const { data: waConnByGhlUser } = await supabase
                .from("whatsapp_connections")
                .select("assigned_user_id, assigned_user_ids")
                .eq("organization_id", orgId)
                .eq("ghl_user_id", sentByGhlUserId)
                .maybeSingle();

              if (waConnByGhlUser) {
                // Use assigned_user_ids[0] first, fallback to assigned_user_id (legacy)
                const firstAssigned =
                  (waConnByGhlUser.assigned_user_ids || [])[0] ??
                  waConnByGhlUser.assigned_user_id ??
                  null;
                if (firstAssigned) {
                  assignedProfileId = firstAssigned;
                  console.log("[ghl-webhook] Found agent via whatsapp_connections config:", assignedProfileId);
                }
              }
            }

            if (assignedProfileId) {
              await supabase
                .from("chats")
                .update({
                  assigned_to: assignedProfileId,
                  assigned_at: new Date().toISOString(),
                  agent_off: true
                })
                .eq("id", chatId)
                .is("assigned_to", null); // only if not already assigned
            }
          } catch (e) {
            console.error("[ghl-webhook] Error assigning from OutboundMessage:", e);
          }
        }

        // If it's from AI/bot, check if bot is allowed before saving & sending
        if (!isFromHumanAgent) {
          // Check global bot setting
          const { data: botSettings } = await supabase
            .from("bot_settings")
            .select("global_bot_enabled")
            .eq("organization_id", orgId)
            .maybeSingle();

          if (botSettings && botSettings.global_bot_enabled === false) {
            console.log("[ghl-webhook] Global bot disabled, blocking GHL AI message");
            break;
          }

          // Check per-lead bot status
          const { data: chatStatus } = await supabase
            .from("chats")
            .select("agent_off, bot_permanently_stopped")
            .eq("id", chatId)
            .single();

          if (chatStatus?.agent_off === true || chatStatus?.bot_permanently_stopped === true) {
            console.log("[ghl-webhook] Bot disabled for this lead, blocking GHL AI message");
            break;
          }
        }

        // Fetch chat logic for Evolution send
        const { data: chat } = await supabase
          .from("chats")
          .select("phone, channel")
          .eq("id", chatId)
          .single();

        if (!chat?.phone) {
          console.error("[ghl-webhook] No phone found for chat:", chatId);
          break;
        }

        // Text-only message
        if (messageBody && !hasAttachments) {
          const { data: savedMsg, error: insertError } = await supabase.from("messages").insert({
            chat_id: chatId,
            organization_id: orgId,
            content: messageBody,
            message_type: "text",
            is_from_user: true,
            sync_source: "ghl",
            external_message_id: messageIdempotencyKey || null,
          }).select("id").single();

          if (insertError) {
             console.log("[ghl-webhook] Insert message error (possibly dup):", insertError);
          } else {
             console.log("[ghl-webhook] Saved outbound logic text:", savedMsg?.id);
          }

          // [BUG-2+4 FIX] Capture the Evolution external ID and persist on the saved message.
          // Without this, the echo event (fromMe=true) from Evolution cannot be deduplicated
          // and the message gets saved twice in the database.
          const { ok: sent, externalId: evoExternalId } = await sendToWhatsApp(supabase, orgId, chat.phone, messageBody, chat.channel);
          console.log("[ghl-webhook] WhatsApp send text result:", sent, "externalId:", evoExternalId);

          if (sent && evoExternalId && savedMsg?.id) {
            // [BUG-4 FIX] ALWAYS update external_message_id to the Evolution ID (evoExternalId),
            // even if we already had a GHL messageIdempotencyKey.
            // This is required so the evolution-webhook-receiver can find this message by its Evolution ID
            // and properly deduplicate the "echo" event that WhatsApp will send back.
            await supabase.from("messages")
              .update({ external_message_id: evoExternalId })
              .eq("id", savedMsg.id)
              .catch((e: any) => console.error("[ghl-webhook] Failed updating external_message_id:", e));
          }
        }

        // Processing attachments
        if (hasAttachments) {
          let firstAttachment = true;
          for (let i = 0; i < attachments.length; i++) {
             const fileUrl = attachments[i];
             const extension = fileUrl.split('?')[0].split('.').pop()?.toLowerCase() || '';
             const isAudio = ['mp3', 'ogg', 'wav', 'm4a', 'oga'].includes(extension);
             const typeStr = isAudio ? 'audio' : (['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? 'image' : (['mp4', 'avi', 'mov'].includes(extension) ? 'video' : 'document'));
             
             // First attachment absorbs the text caption if any
             const currentCaption = (firstAttachment && messageBody) ? messageBody : "";
             const fileNameRaw = fileUrl.split('?')[0].split('/').pop() || `file_${i}.${extension || 'data'}`;
             const slottedExtId = messageIdempotencyKey ? `${messageIdempotencyKey}_${i}` : null;

             const { data: savedMediaMsg, error: insertError } = await supabase.from("messages").insert({
               chat_id: chatId,
               organization_id: orgId,
               content: currentCaption || null,
               message_type: typeStr,
               file_url: fileUrl,
               file_name: fileNameRaw,
               is_from_user: true,
               sync_source: "ghl",
               external_message_id: slottedExtId,
             }).select("id").single();

             if (insertError) {
               console.log("[ghl-webhook] Insert media error (possibly dup):", insertError);
             } else {
               console.log("[ghl-webhook] Saved outbound media:", savedMediaMsg?.id);
             }

             // [BUG-2+4 FIX] Persist Evolution externalId on media messages for echo dedup
             const { ok: sentMedia, externalId: evoMediaId } = await sendToWhatsAppMedia(supabase, orgId, chat.phone, fileUrl, fileNameRaw, currentCaption || undefined, chat.channel);
             console.log(`[ghl-webhook] WhatsApp send media ${i} result:`, sentMedia, "externalId:", evoMediaId);

             if (sentMedia && evoMediaId && savedMediaMsg?.id) {
               // [BUG-4 FIX] ALWAYS update external_message_id to the Evolution ID (evoMediaId).
               await supabase.from("messages")
                 .update({ external_message_id: evoMediaId })
                 .eq("id", savedMediaMsg.id)
                 .catch((e: any) => console.error("[ghl-webhook] Failed updating media external_message_id:", e));
             }
             
             firstAttachment = false;
          }
        }
        break;
      }

      case "AppointmentCreate":
      case "AppointmentUpdate": {
        const appt = body.data || body.payload || body;
        const apptContactId = appt.contactId;
        if (!apptContactId) break;

        const { data: apptContactMap } = await supabase
          .from("ghl_sync_mappings")
          .select("vitta_id")
          .eq("organization_id", orgId)
          .eq("resource_type", "contact")
          .eq("ghl_id", apptContactId)
          .maybeSingle();

        if (apptContactMap?.vitta_id) {
          const eventData = {
            organization_id: orgId,
            title: appt.title || appt.appointmentStatus || "GHL Appointment",
            start_time: appt.startTime || appt.start_time,
            end_time: appt.endTime || appt.end_time,
            chat_id: apptContactMap.vitta_id,
            description: appt.notes || null,
            sync_source: "ghl",
          };

          const { data: existingEventMap } = await supabase
            .from("ghl_sync_mappings")
            .select("vitta_id")
            .eq("organization_id", orgId)
            .eq("resource_type", "calendar_event")
            .eq("ghl_id", appt.id)
            .maybeSingle();

          if (existingEventMap) {
            await supabase
              .from("calendar_events")
              .update(eventData)
              .eq("id", existingEventMap.vitta_id);
          } else if (eventData.start_time && eventData.end_time) {
            const { data: newEvent } = await supabase
              .from("calendar_events")
              .insert(eventData)
              .select("id")
              .single();

            if (newEvent) {
              await supabase.from("ghl_sync_mappings").insert({
                organization_id: orgId,
                resource_type: "calendar_event",
                vitta_id: newEvent.id,
                ghl_id: appt.id,
              });
            }
          }
        }
        break;
      }

      default:
        console.log(`[ghl-webhook] Unhandled event: ${eventType}`);
    }

    // Log webhook
    await supabase.from("ghl_sync_logs").insert({
      organization_id: orgId,
      direction: "ghl_to_vitta",
      resource_type: eventType || "unknown",
      status: "success",
      message: `Webhook processed: ${eventType}`,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ghl-webhook] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
