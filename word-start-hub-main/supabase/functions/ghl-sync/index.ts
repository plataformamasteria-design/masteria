import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

async function refreshTokenIfNeeded(
  supabase: any,
  connection: any,
  config: any
) {
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return connection.access_token;
  }

  const res = await fetch(`${GHL_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  const expiresAt = new Date(
    Date.now() + (data.expires_in || 86400) * 1000
  ).toISOString();

  await supabase
    .from("ghl_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      token_expires_at: expiresAt,
    })
    .eq("id", connection.id)
    .eq("refresh_token", connection.refresh_token); // [FIX-5] Optimistic lock

  // If 0 rows updated, another process already refreshed. Re-read the fresh token.
  const { data: freshConn } = await supabase
    .from("ghl_connections")
    .select("access_token")
    .eq("id", connection.id)
    .single();

  return freshConn?.access_token ?? data.access_token;
}

async function ghlRequest(
  token: string,
  path: string,
  method = "GET",
  body?: any
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };

  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function getOrCreateMapping(
  supabase: any,
  orgId: string,
  resourceType: string,
  vittaId: string,
  ghlId?: string
) {
  const { data } = await supabase
    .from("ghl_sync_mappings")
    .select("*")
    .eq("organization_id", orgId)
    .eq("resource_type", resourceType)
    .eq("vitta_id", vittaId)
    .maybeSingle();

  if (data) return data;

  if (ghlId) {
    const { data: inserted } = await supabase
      .from("ghl_sync_mappings")
      .insert({
        organization_id: orgId,
        resource_type: resourceType,
        vitta_id: vittaId,
        ghl_id: ghlId,
      })
      .select()
      .single();
    return inserted;
  }

  return null;
}

async function resolveConversationProviderId(supabase: any, connection: any) {
  if (connection?.conversation_provider_id) {
    return connection.conversation_provider_id;
  }

  const { data: fallback } = await supabase
    .from("ghl_connections")
    .select("conversation_provider_id")
    .not("conversation_provider_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!fallback?.conversation_provider_id) {
    return null;
  }

  if (connection?.id) {
    await supabase
      .from("ghl_connections")
      .update({ conversation_provider_id: fallback.conversation_provider_id })
      .eq("id", connection.id);
  }

  console.log("Resolved missing conversation_provider_id from existing connection", {
    locationId: connection?.location_id,
  });

  return fallback.conversation_provider_id;
}

// ===== SYNC: Contacts (Vitta → GHL) =====
async function syncContactsToGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string
) {
  // Paginate all chats
  let allChats: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page } = await supabase
      .from("chats")
      .select("id, phone, wa_name, custom_name, is_group")
      .eq("organization_id", orgId)
      .eq("is_group", false)
      .range(from, from + pageSize - 1);
    if (!page?.length) break;
    allChats = allChats.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  const chats = allChats;
  if (!chats?.length) return { synced: 0 };

  let synced = 0;
  for (const chat of chats) {
    try {
      const existing = await getOrCreateMapping(
        supabase,
        orgId,
        "contact",
        chat.id
      );

      const contactData: any = {
        locationId,
        phone: chat.phone?.startsWith("+") ? chat.phone : `+${chat.phone}`,
        name: chat.custom_name || chat.wa_name || chat.phone,
      };

      // Get custom fields
      const { data: fields } = await supabase
        .from("chat_custom_field_values")
        .select("field_id, value, chat_custom_fields!inner(field_key)")
        .eq("chat_id", chat.id)
        .eq("organization_id", orgId);

      if (fields) {
        for (const f of fields) {
          const key = (f as any).chat_custom_fields?.field_key;
          if (key === "email" && f.value) contactData.email = f.value;
          if (key === "empresa" && f.value) contactData.companyName = f.value;
          if (key === "endereco" && f.value) contactData.address1 = f.value;
          if (key === "cidade" && f.value) contactData.city = f.value;
          if (key === "estado" && f.value) contactData.state = f.value;
          if (key === "cep" && f.value) contactData.postalCode = f.value;
        }
      }

      if (existing?.ghl_id) {
        // Update existing - remove locationId for PUT (GHL rejects it)
        const { locationId: _removed, ...updateData } = contactData;
        await ghlRequest(
          token,
          `/contacts/${existing.ghl_id}`,
          "PUT",
          updateData
        );
      } else {
        // Create new
        const result = await ghlRequest(token, "/contacts/", "POST", contactData);
        if (result?.contact?.id) {
          await supabase.from("ghl_sync_mappings").insert({
            organization_id: orgId,
            resource_type: "contact",
            vitta_id: chat.id,
            ghl_id: result.contact.id,
          });
        }
      }
      synced++;
    } catch (err) {
      console.error(`Error syncing contact ${chat.id}:`, err);
      await supabase.from("ghl_sync_logs").insert({
        organization_id: orgId,
        direction: "vitta_to_ghl",
        resource_type: "contact",
        resource_id: chat.id,
        status: "error",
        message: String(err),
      });
    }
  }

  return { synced };
}

// ===== SYNC: Contacts (GHL → Vitta) =====
async function syncContactsFromGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string,
  orgInstanceName?: string | null
) {
  let synced = 0;
  let nextPageUrl: string | null = `/contacts/?locationId=${locationId}&limit=100`;

  // Use the org's actual instance name as channel so new chats
  // are always compatible with what the Evolution webhook creates.
  // Fallback to 'whatsapp' only if we don't have a real instance name.
  const channelName = orgInstanceName || "whatsapp";

  while (nextPageUrl) {
    const result = await ghlRequest(token, nextPageUrl);
    const contacts = result.contacts || [];

    for (const contact of contacts) {
      try {
        // Check if already mapped
        const { data: existing } = await supabase
          .from("ghl_sync_mappings")
          .select("vitta_id")
          .eq("organization_id", orgId)
          .eq("resource_type", "contact")
          .eq("ghl_id", contact.id)
          .maybeSingle();

        if (existing) continue; // Already synced

        if (!contact.phone) continue; // Need phone for WhatsApp

        const phone = contact.phone.replace(/\D/g, "");
        if (!phone) continue;

        // Check if chat exists with this phone (any channel — unique index guarantees 1 per phone/org)
        const { data: existingChat } = await supabase
          .from("chats")
          .select("id")
          .eq("organization_id", orgId)
          .eq("phone", phone)
          .maybeSingle();

        if (existingChat) {
          // Map existing chat — use upsert to avoid duplicate mapping errors
          await supabase.from("ghl_sync_mappings").upsert(
            {
              organization_id: orgId,
              resource_type: "contact",
              vitta_id: existingChat.id,
              ghl_id: contact.id,
            },
            { onConflict: "organization_id,resource_type,ghl_id" }
          );
        } else {
          // Create new chat — upsert on (organization_id, phone) prevents race-condition duplicates
          const { data: newChat, error: insertErr } = await supabase
            .from("chats")
            .upsert(
              {
                organization_id: orgId,
                phone,
                wa_name: contact.name || contact.firstName || phone,
                custom_name:
                  contact.name ||
                  `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
                  null,
                channel: channelName,
              },
              { onConflict: "organization_id,phone", ignoreDuplicates: false }
            )
            .select("id")
            .maybeSingle();

          if (insertErr) {
            console.error(`[ghl-sync] Error upserting chat for contact ${contact.id}:`, insertErr);
            continue;
          }

          if (newChat) {
            await supabase.from("ghl_sync_mappings").upsert(
              {
                organization_id: orgId,
                resource_type: "contact",
                vitta_id: newChat.id,
                ghl_id: contact.id,
              },
              { onConflict: "organization_id,resource_type,ghl_id" }
            );
          }
        }
        synced++;
      } catch (err) {
        console.error(`[ghl-sync] Error importing GHL contact ${contact.id}:`, err);
      }
    }

    nextPageUrl = result.meta?.nextPageUrl
      ? result.meta.nextPageUrl.replace(GHL_BASE, "")
      : null;
  }

  return { synced };
}

// ===== SYNC: Pipelines (Vitta → GHL) =====
async function syncPipelinesToGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string
) {
  const { data: funnels } = await supabase
    .from("funnels")
    .select("id, name, funnel_stages(id, name, order_position)")
    .eq("organization_id", orgId);

  if (!funnels?.length) return { synced: 0 };

  let synced = 0;
  for (const funnel of funnels) {
    try {
      const existing = await getOrCreateMapping(
        supabase,
        orgId,
        "pipeline",
        funnel.id
      );

      const stages = (funnel.funnel_stages || [])
        .sort((a: any, b: any) => a.order_position - b.order_position)
        .map((s: any) => ({ name: s.name }));

      if (existing?.ghl_id) {
        // Pipeline exists, skip (GHL doesn't support pipeline update easily)
      } else {
        const result = await ghlRequest(
          token,
          `/opportunities/pipelines`,
          "POST",
          {
            locationId,
            name: funnel.name,
            stages,
          }
        );

        if (result?.pipeline?.id) {
          await supabase.from("ghl_sync_mappings").insert({
            organization_id: orgId,
            resource_type: "pipeline",
            vitta_id: funnel.id,
            ghl_id: result.pipeline.id,
          });

          // Map stages
          if (result.pipeline.stages) {
            for (let i = 0; i < result.pipeline.stages.length; i++) {
              const ghlStage = result.pipeline.stages[i];
              const vittaStage = funnel.funnel_stages?.sort(
                (a: any, b: any) => a.order_position - b.order_position
              )[i];
              if (vittaStage && ghlStage) {
                await supabase.from("ghl_sync_mappings").insert({
                  organization_id: orgId,
                  resource_type: "stage",
                  vitta_id: vittaStage.id,
                  ghl_id: ghlStage.id,
                });
              }
            }
          }
        }
      }
      synced++;
    } catch (err) {
      console.error(`Error syncing pipeline ${funnel.id}:`, err);
    }
  }

  return { synced };
}

// ===== SYNC: Pipelines (GHL → Vitta) =====
async function syncPipelinesFromGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string
) {
  let synced = 0;
  try {
    const result = await ghlRequest(token, `/opportunities/pipelines?locationId=${locationId}`);
    const pipelines = result.pipelines || [];

    for (const pipeline of pipelines) {
      if (!pipeline.id || !pipeline.name) continue;

      let vittaFunnelId;
      const { data: existingMap } = await supabase
        .from("ghl_sync_mappings")
        .select("vitta_id")
        .eq("organization_id", orgId)
        .eq("resource_type", "pipeline")
        .eq("ghl_id", pipeline.id)
        .maybeSingle();

      if (existingMap) {
        vittaFunnelId = existingMap.vitta_id;
      } else {
        const { data: newFunnel } = await supabase
          .from("funnels")
          .insert({
            organization_id: orgId,
            name: pipeline.name,
          })
          .select("id")
          .single();

        if (newFunnel) {
          vittaFunnelId = newFunnel.id;
          await supabase.from("ghl_sync_mappings").insert({
            organization_id: orgId,
            resource_type: "pipeline",
            vitta_id: vittaFunnelId,
            ghl_id: pipeline.id,
          });
        }
      }

      if (vittaFunnelId && pipeline.stages) {
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          if (!stage.id || !stage.name) continue;

          const { data: existingStageMap } = await supabase
            .from("ghl_sync_mappings")
            .select("vitta_id")
            .eq("organization_id", orgId)
            .eq("resource_type", "stage")
            .eq("ghl_id", stage.id)
            .maybeSingle();

          if (!existingStageMap) {
            const { data: newStage } = await supabase
              .from("funnel_stages")
              .insert({
                funnel_id: vittaFunnelId,
                name: stage.name,
                order_position: i,
              })
              .select("id")
              .single();

            if (newStage) {
              await supabase.from("ghl_sync_mappings").insert({
                organization_id: orgId,
                resource_type: "stage",
                vitta_id: newStage.id,
                ghl_id: stage.id,
              });
            }
          }
        }
      }
      synced++;
    }
  } catch (err) {
    console.error("Error syncing pipelines from GHL:", err);
    throw err;
  }

  return { synced };
}

// ===== SYNC: Tags (Vitta → GHL) =====
async function syncTagsToGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string
) {
  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("organization_id", orgId);

  if (!tags?.length) return { synced: 0 };

  let synced = 0;
  for (const tag of tags) {
    try {
      const existing = await getOrCreateMapping(
        supabase,
        orgId,
        "tag",
        tag.id
      );

      if (!existing) {
        await ghlRequest(token, `/locations/${locationId}/tags`, "POST", {
          name: tag.name,
        });

        // GHL tags API may not return the created tag ID consistently,
        // so we query it back
        const tagsResult = await ghlRequest(
          token,
          `/locations/${locationId}/tags`
        );
        const ghlTag = tagsResult.tags?.find(
          (t: any) => t.name === tag.name
        );
        if (ghlTag) {
          await supabase.from("ghl_sync_mappings").insert({
            organization_id: orgId,
            resource_type: "tag",
            vitta_id: tag.id,
            ghl_id: ghlTag.id,
          });
        }
        synced++;
      }
    } catch (err) {
      console.error(`Error syncing tag ${tag.id}:`, err);
    }
  }

  return { synced };
}

// ===== SYNC: Conversations/Messages (Vitta → GHL) =====
async function syncConversationsToGHL(
  supabase: any,
  token: string,
  orgId: string,
  locationId: string,
  conversationProviderId?: string,
  offset = 0,
  batchSize = 20
) {
  // Get contact mappings with pagination
  const { data: mappings } = await supabase
    .from("ghl_sync_mappings")
    .select("vitta_id, ghl_id")
    .eq("organization_id", orgId)
    .eq("resource_type", "contact")
    .order("created_at", { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (!mappings?.length) return { synced: 0, skipped: 0, offset, done: true };

  let synced = 0;
  let skipped = 0;

  for (const mapping of mappings) {
    try {
      // Get recent messages for this chat (last 50 outbound messages not from GHL)
      const { data: messages } = await supabase
        .from("messages")
        .select("id, content, message_type, is_from_user, created_at, sync_source")
        .eq("chat_id", mapping.vitta_id)
        .eq("organization_id", orgId)
        .eq("message_type", "text")
        .eq("private", false)
        .is("sync_source", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (!messages?.length) {
        skipped++;
        continue;
      }

      for (const msg of messages) {
        try {
          // Send as inbound (from contact) or outbound based on is_from_user
          // In Vitta: is_from_user=false means message FROM the lead (inbound WhatsApp)
          const direction = msg.is_from_user ? "outbound" : "inbound";
          const isMarketplaceChannel = !!conversationProviderId;

          const sendViaLegacyEndpoint = async (forceSms: boolean) => {
            const useSms = forceSms || !isMarketplaceChannel;
            const payload: any = {
              contactId: mapping.ghl_id,
              type: useSms ? "SMS" : "Custom",
              message: msg.content,
              direction,
            };
            if (locationId) payload.locationId = locationId;
            if (!useSms && conversationProviderId) {
              payload.conversationProviderId = conversationProviderId;
            }

            return ghlRequest(token, "/conversations/messages", "POST", payload);
          };

          const sendWithProviderFallback = async () => {
            try {
              return await sendViaLegacyEndpoint(false);
            } catch (sendErr) {
              const errMessage = String(sendErr || "");
              const shouldFallbackToSms =
                !!conversationProviderId &&
                errMessage.includes("No conversation provider found");

              if (!shouldFallbackToSms) {
                throw sendErr;
              }

              console.warn(
                "Custom provider not found in GHL for this location during history sync, retrying as SMS",
                { conversationProviderId, locationId }
              );

              return sendViaLegacyEndpoint(true);
            }
          };

          if (direction === "inbound") {
            const inboundPayload: any = {
              contactId: mapping.ghl_id,
              type: isMarketplaceChannel ? "Custom" : "SMS",
              message: msg.content,
              direction: "inbound",
              idempotencyKey: msg.id,
            };
            if (locationId) inboundPayload.locationId = locationId;
            if (conversationProviderId) {
              inboundPayload.conversationProviderId = conversationProviderId;
            }

            const alternateInboundPayload: any = {
              contactId: mapping.ghl_id,
              channel: isMarketplaceChannel ? "whatsapp" : "sms",
              content: {
                text: msg.content,
              },
              idempotencyKey: msg.id,
            };
            if (locationId) alternateInboundPayload.locationId = locationId;
            if (conversationProviderId) {
              alternateInboundPayload.conversationProviderId = conversationProviderId;
            }

            try {
              const inboundAttempts = [
                {
                  endpoint: "/conversations/messages/inbound",
                  payload: inboundPayload,
                },
                {
                  endpoint: "/conversations/inbound-messages",
                  payload: alternateInboundPayload,
                },
              ];

              let inboundSent = false;
              let lastInboundErr: unknown = null;

              for (const attempt of inboundAttempts) {
                try {
                  await ghlRequest(token, attempt.endpoint, "POST", attempt.payload);
                  inboundSent = true;
                  break;
                } catch (endpointErr) {
                  lastInboundErr = endpointErr;
                  const errMessage = String(endpointErr || "");
                  const isEndpointNotFound =
                    errMessage.includes("Cannot POST") ||
                    errMessage.includes("failed (404)");

                  if (!isEndpointNotFound) {
                    throw endpointErr;
                  }

                  console.warn(
                    "Inbound endpoint unavailable during history sync, trying next",
                    { endpoint: attempt.endpoint, error: errMessage.substring(0, 200) }
                  );
                }
              }

              if (!inboundSent && lastInboundErr) {
                throw lastInboundErr;
              }
            } catch (inboundErr) {
              console.warn(
                "Inbound endpoint failed during history sync, retrying with legacy endpoint",
                { error: String(inboundErr).substring(0, 200) }
              );
              await sendWithProviderFallback();
            }
          } else {
            await sendWithProviderFallback();
          }

          // Small delay to avoid rate limiting
          await new Promise((r) => setTimeout(r, 100));
        } catch (msgErr) {
          console.error(`Error syncing message ${msg.id}:`, msgErr);
        }
      }
      synced++;
    } catch (err) {
      console.error(`Error syncing conversations for chat ${mapping.vitta_id}:`, err);
      skipped++;
    }
  }

  const done = mappings.length < batchSize;
  return { synced, skipped, nextOffset: offset + mappings.length, done };
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
    const { organization_id, sync_type, offset, batch_size } = body;
    // sync_type: 'all' | 'contacts' | 'pipelines' | 'tags' | 'contacts_from_ghl' | 'conversations'

    if (!organization_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "organization_id required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from("ghl_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ ok: false, error: "GHL não conectado para esta organização" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch org instance_name so we create chats with the correct channel value
    const { data: orgData } = await supabase
      .from("organizations")
      .select("instance_name, slug")
      .eq("id", organization_id)
      .maybeSingle();

    const orgInstanceName = orgData?.instance_name || orgData?.slug || null;

    // Get config
    const { data: config } = await supabase
      .from("ghl_global_config")
      .select("*")
      .limit(1)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ ok: false, error: "Configuração GHL global não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Refresh token
    const token = await refreshTokenIfNeeded(supabase, connection, config);
    const locationId = connection.location_id;

    if (!locationId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Location ID não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const conversationProviderId = await resolveConversationProviderId(supabase, connection);

    const results: Record<string, any> = {};
    const type = sync_type || "all";

    if (type === "all" || type === "contacts") {
      results.contacts_to_ghl = await syncContactsToGHL(
        supabase,
        token,
        organization_id,
        locationId
      );
    }

    if (type === "all" || type === "contacts_from_ghl") {
      results.contacts_from_ghl = await syncContactsFromGHL(
        supabase,
        token,
        organization_id,
        locationId,
        orgInstanceName
      );
    }

    if (type === "all" || type === "pipelines") {
      results.pipelines = await syncPipelinesToGHL(
        supabase,
        token,
        organization_id,
        locationId
      );
    }

    if (type === "pipelines_from_ghl") {
      results.pipelines_from_ghl = await syncPipelinesFromGHL(
        supabase,
        token,
        organization_id,
        locationId
      );
    }

    if (type === "all" || type === "tags") {
      results.tags = await syncTagsToGHL(
        supabase,
        token,
        organization_id,
        locationId
      );
    }

    if (type === "conversations") {
      // Sync message history only (contacts should already be mapped)
      results.conversations = await syncConversationsToGHL(
        supabase,
        token,
        organization_id,
        locationId,
        conversationProviderId,
        offset || 0,
        batch_size || 20
      );
    }

    if (type === "users") {
      const usersData = await ghlRequest(token, `/users/?locationId=${locationId}`);
      results.users = usersData.users || [];
    }

    // Update last_sync_at
    await supabase
      .from("ghl_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("organization_id", organization_id);

    // Log success
    await supabase.from("ghl_sync_logs").insert({
      organization_id,
      direction: "vitta_to_ghl",
      resource_type: type,
      status: "success",
      message: JSON.stringify(results),
    });

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("GHL sync error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
