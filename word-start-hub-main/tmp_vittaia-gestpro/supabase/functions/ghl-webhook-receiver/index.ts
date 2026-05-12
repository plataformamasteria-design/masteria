import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Get Evolution API config for an organization (same logic as send-to-evolution)
 */
async function getEvolutionConfig(supabase: any, orgId: string) {
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
  const instanceName = org.instance_name || org.slug;

  return { url: cleanUrl, apiKey: evolutionKey, instanceName };
}

/**
 * Send a text message to WhatsApp via Evolution API
 */
async function sendToWhatsApp(
  supabase: any,
  orgId: string,
  phone: string,
  content: string
) {
  const config = await getEvolutionConfig(supabase, orgId);
  if (!config) {
    console.error("[ghl-webhook] No Evolution API config found for org:", orgId);
    return false;
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

    return response.ok;
  } catch (err) {
    console.error("[ghl-webhook] Error sending to Evolution:", err);
    return false;
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
 * Find or create a chat for a contact, and ensure GHL mapping exists
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

  // Try to find chat by phone
  const { data: existingChat } = await supabase
    .from("chats")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", cleanPhone)
    .maybeSingle();

  let chatId = null;

  if (existingChat) {
    // Create mapping for existing chat
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
    // Create new chat
    const { data: newChat } = await supabase
      .from("chats")
      .insert({
        organization_id: orgId,
        phone: cleanPhone,
        wa_name: name || cleanPhone,
        custom_name: name || null,
        channel: "whatsapp",
      })
      .select("id")
      .single();

    if (newChat) {
      await supabase.from("ghl_sync_mappings").insert({
        organization_id: orgId,
        resource_type: "contact",
        vitta_id: newChat.id,
        ghl_id: ghlContactId,
      });
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
        // Inbound messages from leads already arrive via Evolution webhook
        // Skip to avoid duplicates
        console.log("[ghl-webhook] InboundMessage skipped (already arrives via Evolution)");
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

        console.log("[ghl-webhook] Outbound message event:", {
          eventType,
          contactId,
          hasUserId: !!(body.userId || msg.userId),
          hasBody: !!messageBody,
          bodyPreview: messageBody?.substring(0, 100),
        });

        if (!contactId || !messageBody) {
          console.log("[ghl-webhook] Missing contactId or message body, skipping");
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

        // Also check for duplicate content within 30 seconds (in case message came from Vitta → GHL → back)
        const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
        const { data: recentDupe } = await supabase
          .from("messages")
          .select("id")
          .eq("chat_id", chatId)
          .eq("organization_id", orgId)
          .eq("content", messageBody)
          .eq("is_from_user", true)
          .gte("created_at", thirtySecsAgo)
          .maybeSingle();

        if (recentDupe) {
          console.log("[ghl-webhook] Duplicate outbound message detected, skipping");
          break;
        }

        // Check if this is an AI/bot message (no userId = bot/automation)
        const isFromHumanAgent = !!(body.userId || (body.data || body.payload || body).userId);
        const sentByGhlUserId = body.userId || (body.data || body.payload || body).userId;

        // Auto-assign chat if we know who sent the message
        if (sentByGhlUserId && chatId) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("organization_id", orgId)
              .eq("ghl_user_id", sentByGhlUserId)
              .maybeSingle();

            if (profile?.id) {
              await supabase
                .from("chats")
                .update({
                  assigned_to: profile.id,
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

        // Save as agent message (is_from_user = true)
        const { data: savedMsg } = await supabase.from("messages").insert({
          chat_id: chatId,
          organization_id: orgId,
          content: messageBody,
          message_type: "text",
          is_from_user: true,
          sync_source: "ghl",
          external_message_id: messageIdempotencyKey || null,
        }).select("id").single();

        console.log("[ghl-webhook] Saved outbound message:", savedMsg?.id);

        // Send to WhatsApp via Evolution
        const { data: chat } = await supabase
          .from("chats")
          .select("phone")
          .eq("id", chatId)
          .single();

        if (chat?.phone) {
          const sent = await sendToWhatsApp(supabase, orgId, chat.phone, messageBody);
          console.log("[ghl-webhook] WhatsApp send result:", sent);
        } else {
          console.error("[ghl-webhook] No phone found for chat:", chatId);
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
