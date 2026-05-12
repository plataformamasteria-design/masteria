import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

async function refreshTokenIfNeeded(supabase: any, connection: any, config: any) {
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const now = new Date();
    const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

    console.log("Token check:", {
        expires_at: expiresAt?.toISOString(),
        now: now.toISOString(),
        is_valid: expiresAt ? expiresAt > fiveMinFromNow : false
    });

    if (expiresAt && expiresAt > fiveMinFromNow) {
        console.log("Token still valid, using existing");
        return connection.access_token;
    }

    console.log("Token expired or expiring soon, refreshing...");
    try {
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
        console.log("Token refresh response:", { ok: res.ok, status: res.status, has_access_token: !!data.access_token, error: data.error || data.error_description });

        if (!res.ok || !data.access_token) {
            throw new Error(`Token refresh failed (${res.status}): ${JSON.stringify(data)}`);
        }

        const newExpiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString();
        console.log("New token expires at:", newExpiresAt);

        await supabase.from("ghl_connections").update({
            access_token: data.access_token,
            refresh_token: data.refresh_token || connection.refresh_token,
            token_expires_at: newExpiresAt,
        }).eq("id", connection.id);

        return data.access_token;
    } catch (err) {
        console.error("Token refresh error:", err);
        throw err;
    }
}

async function ghlRequest(token: string, path: string, method = "GET", body?: any) {
    const res = await fetch(`${GHL_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GHL API ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
}

function extractOrganization(record: any) {
    return record.organization_id;
}

/**
 * Build a human-readable message text.
 * For media messages without a caption, returns a descriptive emoji label.
 */
function buildMessageText(record: any): string {
    if (record.content?.trim()) return record.content;
    const typeLabels: Record<string, string> = {
        audio: '🎤 Áudio',
        image: '📷 Imagem',
        video: '🎥 Vídeo',
        pdf: '📄 Documento',
        document: '📎 Documento',
    };
    return typeLabels[record.message_type] || 'Mensagem';
}

/**
 * Build attachments array from file_url when present.
 * GHL expects an array of publicly accessible URLs.
 */
function buildAttachments(record: any): string[] {
    if (!record.file_url) return [];
    return [record.file_url];
}

/**
 * Auto-create a GHL contact for a Vitta chat if no mapping exists.
 * Returns the GHL contact ID or null.
 */
async function autoCreateGhlContact(
    supabase: any,
    token: string,
    orgId: string,
    chatId: string,
    locationId: string
): Promise<string | null> {
    try {
        const { data: chat } = await supabase
            .from("chats")
            .select("phone, wa_name, custom_name, is_group")
            .eq("id", chatId)
            .single();

        if (!chat?.phone) {
            console.log("autoCreateGhlContact: No phone for chat", chatId);
            return null;
        }

        if (chat.is_group || String(chat.phone).includes("@g.us")) {
            console.log("autoCreateGhlContact: Group chat detected, skipping", chatId);
            return null;
        }

        const cleanPhone = String(chat.phone).replace(/\D/g, "");
        if (cleanPhone.length < 10) {
            console.log("autoCreateGhlContact: Invalid phone format, skipping", { chatId, phone: chat.phone });
            return null;
        }

        const phone = `+${cleanPhone}`;
        const name = chat.custom_name || chat.wa_name || cleanPhone;

        try {
            const searchResult = await ghlRequest(
                token,
                `/contacts/search/duplicate?locationId=${locationId}&number=${encodeURIComponent(phone)}`
            );

            if (searchResult?.contact?.id) {
                console.log("autoCreateGhlContact: Found existing GHL contact:", searchResult.contact.id);
                await supabase.from("ghl_sync_mappings").upsert(
                    {
                        organization_id: orgId,
                        resource_type: "contact",
                        vitta_id: chatId,
                        ghl_id: searchResult.contact.id,
                    },
                    { onConflict: "organization_id,resource_type,ghl_id" }
                );
                return searchResult.contact.id;
            }
        } catch (searchErr) {
            console.log("autoCreateGhlContact: Search failed, creating new:", String(searchErr).substring(0, 120));
        }

        const result = await ghlRequest(token, "/contacts/", "POST", {
            locationId,
            phone,
            name,
        });

        if (result?.contact?.id) {
            console.log("autoCreateGhlContact: Created GHL contact:", result.contact.id);
            await supabase.from("ghl_sync_mappings").insert({
                organization_id: orgId,
                resource_type: "contact",
                vitta_id: chatId,
                ghl_id: result.contact.id,
            });
            return result.contact.id;
        }

        return null;
    } catch (err) {
        console.error("autoCreateGhlContact error:", err);
        return null;
    }
}

async function resolveConversationProviderId(supabase: any, connection: any): Promise<string | null> {
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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const payload = await req.json();
        console.log("Outbound sync payload received:", payload.table, payload.type);

        const { table, record } = payload;
        const orgId = extractOrganization(record);
        if (!orgId) return new Response(JSON.stringify({ ok: true, msg: "No org_id" }), { headers: corsHeaders });

        const { data: connection, error: connErr } = await supabase.from("ghl_connections").select("*").eq("organization_id", orgId).maybeSingle();
        console.log("GHL connection lookup:", { orgId, found: !!connection, error: connErr?.message });
        if (!connection) return new Response(JSON.stringify({ ok: true, msg: "No GHL connection for org " + orgId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: config, error: cfgErr } = await supabase.from("ghl_global_config").select("*").limit(1).single();
        console.log("GHL global config:", { found: !!config, error: cfgErr?.message });
        if (!config) return new Response(JSON.stringify({ ok: true, msg: "No GHL config" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const token = await refreshTokenIfNeeded(supabase, connection, config);
        const conversationProviderId = await resolveConversationProviderId(supabase, connection);

        if (table === "messages") {
            let { data: chatMapping, error: mapErr } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id).maybeSingle();

            console.log("Message sync - contact mapping:", { chat_id: record.chat_id, ghl_contact_id: chatMapping?.ghl_id, error: mapErr?.message });

            // Auto-create GHL contact if mapping doesn't exist
            if (!chatMapping?.ghl_id && connection.location_id) {
                console.log("Auto-creating GHL contact for chat:", record.chat_id);
                const ghlContactId = await autoCreateGhlContact(
                    supabase, token, orgId, record.chat_id, connection.location_id
                );
                if (ghlContactId) {
                    chatMapping = { ghl_id: ghlContactId };
                    console.log("Auto-created GHL contact:", ghlContactId);
                }
            }

            if (chatMapping?.ghl_id) {
                const isMarketplaceChannel = !!conversationProviderId;
                // is_from_user=true means agent sent it (outbound from platform)
                // is_from_user=false means lead sent it (inbound from WhatsApp)
                const direction = record.is_from_user ? "outbound" : "inbound";

                const messageText = buildMessageText(record);
                const attachments = buildAttachments(record);

                const sendViaLegacyEndpoint = async (forceSms: boolean) => {
                    const useSms = forceSms || !isMarketplaceChannel;
                    const payload: any = {
                        contactId: chatMapping.ghl_id,
                        type: useSms ? "SMS" : "Custom",
                        message: messageText,
                        direction,
                    };
                    if (attachments.length > 0) payload.attachments = attachments;
                    if (connection.location_id) payload.locationId = connection.location_id;
                    if (!useSms && isMarketplaceChannel) {
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
                            isMarketplaceChannel &&
                            errMessage.includes("No conversation provider found");

                        if (!shouldFallbackToSms) {
                            throw sendErr;
                        }

                        console.warn("Custom provider not found, retrying as SMS", {
                            providerId: conversationProviderId,
                            locationId: connection.location_id,
                        });

                        return sendViaLegacyEndpoint(true);
                    }
                };

                if (direction === "inbound") {
                    const inboundPayload: any = {
                        contactId: chatMapping.ghl_id,
                        type: isMarketplaceChannel ? "Custom" : "SMS",
                        message: messageText,
                        direction: "inbound",
                        idempotencyKey: record.id,
                    };
                    if (attachments.length > 0) inboundPayload.attachments = attachments;
                    if (connection.location_id) inboundPayload.locationId = connection.location_id;
                    if (isMarketplaceChannel) {
                        inboundPayload.conversationProviderId = conversationProviderId;
                    }

                    const alternateInboundPayload: any = {
                        contactId: chatMapping.ghl_id,
                        channel: isMarketplaceChannel ? "whatsapp" : "sms",
                        content: {
                            text: messageText,
                        },
                        idempotencyKey: record.id,
                    };
                    if (attachments.length > 0) alternateInboundPayload.attachments = attachments;
                    if (connection.location_id) alternateInboundPayload.locationId = connection.location_id;
                    if (isMarketplaceChannel) {
                        alternateInboundPayload.conversationProviderId = conversationProviderId;
                    }

                    console.log("Sending inbound message to GHL:", {
                        contactId: chatMapping.ghl_id,
                        locationId: connection.location_id,
                        providerId: conversationProviderId,
                        type: inboundPayload.type,
                        message: messageText?.substring(0, 50),
                        hasAttachments: attachments.length > 0,
                        messageType: record.message_type,
                    });

                    try {
                        const inboundAttempts = [
                            { endpoint: "/conversations/messages/inbound", payload: inboundPayload },
                            { endpoint: "/conversations/inbound-messages", payload: alternateInboundPayload },
                        ];

                        let inboundResult: any = null;
                        let lastInboundErr: unknown = null;

                        for (const attempt of inboundAttempts) {
                            try {
                                inboundResult = await ghlRequest(token, attempt.endpoint, "POST", attempt.payload);
                                console.log("GHL inbound message sent successfully:", {
                                    endpoint: attempt.endpoint,
                                    result: JSON.stringify(inboundResult).substring(0, 200),
                                });
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

                                console.warn("Inbound endpoint unavailable, trying next", {
                                    endpoint: attempt.endpoint,
                                    error: errMessage.substring(0, 200),
                                });
                            }
                        }

                        if (!inboundResult && lastInboundErr) {
                            throw lastInboundErr;
                        }
                    } catch (inboundErr) {
                        console.warn("Inbound endpoint failed, retrying with legacy endpoint", {
                            error: String(inboundErr).substring(0, 200),
                        });
                        const legacyResult = await sendWithProviderFallback();
                        console.log("GHL inbound message sent with legacy endpoint:", JSON.stringify(legacyResult).substring(0, 200));
                    }
                } else {
                    console.log("Sending outbound message to GHL:", {
                        contactId: chatMapping.ghl_id,
                        locationId: connection.location_id,
                        providerId: conversationProviderId,
                        type: isMarketplaceChannel ? "Custom" : "SMS",
                        direction,
                        message: messageText?.substring(0, 50),
                        hasAttachments: attachments.length > 0,
                        messageType: record.message_type,
                    });

                    const result = await sendWithProviderFallback();
                    console.log("GHL outbound message sent successfully:", JSON.stringify(result).substring(0, 200));
                }
            } else {
                console.log("No GHL contact mapping found for chat_id:", record.chat_id, "- message NOT synced");
            }
        } else if (table === "chat_funnel_stage") {
            const { data: oppMapping } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "pipeline").eq("vitta_id", record.funnel_id).maybeSingle();
            const { data: stageMapping } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "stage").eq("vitta_id", record.stage_id).maybeSingle();
            const { data: contactMapping } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id).maybeSingle();

            if (oppMapping && stageMapping && contactMapping) {
                const oppsRes = await ghlRequest(token, `/opportunities/search?pipeline_id=${oppMapping.ghl_id}&contact_id=${contactMapping.ghl_id}`);
                if (oppsRes.opportunities?.length > 0) {
                    const opp = oppsRes.opportunities[0];
                    await ghlRequest(token, `/opportunities/${opp.id}`, "PUT", { pipelineStageId: stageMapping.ghl_id });
                } else {
                    await ghlRequest(token, "/opportunities/", "POST", {
                        pipelineId: oppMapping.ghl_id,
                        pipelineStageId: stageMapping.ghl_id,
                        contactId: contactMapping.ghl_id,
                        name: "Opportunity from Vitta",
                        locationId: connection.location_id
                    });
                }
            }
        } else if (table === "calendar_events") {
            // Sync calendar events to GHL
            const { data: contactMapping } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id).maybeSingle();

            if (!contactMapping?.ghl_id) {
                console.log("No GHL contact mapping for chat_id:", record.chat_id);
            } else {
                // Check for existing event mapping
                const { data: eventMapping } = await supabase.from("ghl_sync_mappings")
                    .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "calendar_event").eq("vitta_id", record.id).maybeSingle();

                // Get calendars from GHL to find a calendar
                let ghlCalendarId: string | null = null;
                try {
                    const calsRes = await ghlRequest(token, `/calendars/?locationId=${connection.location_id}`);
                    if (calsRes.calendars?.length > 0) {
                        ghlCalendarId = calsRes.calendars[0].id;
                    }
                } catch (e) {
                    console.error("Failed to fetch GHL calendars:", e);
                }

                if (ghlCalendarId) {
                    const eventPayload = {
                        calendarId: ghlCalendarId,
                        locationId: connection.location_id,
                        contactId: contactMapping.ghl_id,
                        startTime: record.start_time,
                        endTime: record.end_time,
                        title: record.title || "Vitta Event",
                        description: record.description || "",
                    };

                    if (eventMapping?.ghl_id) {
                        // Update existing
                        try {
                            await ghlRequest(token, `/calendars/events/${eventMapping.ghl_id}`, "PUT", eventPayload);
                        } catch (e) {
                            console.error("Failed to update GHL event:", e);
                        }
                    } else {
                        // Create new
                        try {
                            const newEvent = await ghlRequest(token, "/calendars/events", "POST", eventPayload);
                            if (newEvent?.id || newEvent?.event?.id) {
                                await supabase.from("ghl_sync_mappings").insert({
                                    organization_id: orgId,
                                    resource_type: "calendar_event",
                                    vitta_id: record.id,
                                    ghl_id: newEvent.id || newEvent.event.id,
                                });
                            }
                        } catch (e) {
                            console.error("Failed to create GHL event:", e);
                        }
                    }
                }
            }
        } else if (table === "bookings") {
            const { data: contactMapping } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id).maybeSingle();

            let ghlCalendarId: string | null = null;
            try {
                const calsRes = await ghlRequest(token, `/calendars/?locationId=${connection.location_id}`);
                if (calsRes.calendars?.length > 0) {
                    ghlCalendarId = calsRes.calendars[0].id;
                }
            } catch (_e) { /* ignore */ }

            if (contactMapping && ghlCalendarId) {
                await ghlRequest(token, "/calendars/events", "POST", {
                    calendarId: ghlCalendarId,
                    locationId: connection.location_id,
                    contactId: contactMapping.ghl_id,
                    startTime: record.start_time,
                    endTime: record.end_time,
                    title: record.service_name || "Vitta Booking",
                });
            }
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
        console.error("GHL outbound sync error:", err);
        return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: corsHeaders, status: 500 });
    }
});
