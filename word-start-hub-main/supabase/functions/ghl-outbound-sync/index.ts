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

        // [FIX-5] Optimistic lock: only update if refresh_token is still the one we read.
        // This prevents two concurrent processes from overwriting each other's tokens.
        const { count: updatedRows } = await supabase
            .from("ghl_connections")
            .update({
                access_token: data.access_token,
                refresh_token: data.refresh_token || connection.refresh_token,
                token_expires_at: newExpiresAt,
            })
            .eq("id", connection.id)
            .eq("refresh_token", connection.refresh_token) // Optimistic lock
            .select("id", { count: "exact", head: true });

        if (!updatedRows || updatedRows === 0) {
            // Another concurrent process already refreshed the token. Read the fresh one from DB.
            console.log("Token refresh skipped — another process already renewed it. Re-reading from DB.");
            const { data: freshConn } = await supabase
                .from("ghl_connections")
                .select("access_token")
                .eq("id", connection.id)
                .single();
            return freshConn?.access_token ?? data.access_token;
        }

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
 * Retorna o texto original da mensagem sem inserir rótulos ou URLs de mídia poluindo o painel.
 */
function buildMessageText(record: any): string {
    return record.content?.trim() ? record.content.trim() : '';
}

/**
 * Get attachment info from record
 */
function getAttachmentInfo(record: any): { url: string; filename: string } | null {
    if (!record.file_url) return null;

    const url: string = record.file_url;
    let ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    
    // Se a extensão for suspeita de ser falsa (ex: "unknown" ou uma string gigante sem ponto)
    if (!ext || ext.length > 5 || ext === 'unknown' || ext === 'data') {
        const typeMap: Record<string, string> = {
            'audio': 'mp3',
            'video': 'mp4',
            'image': 'jpg',
            'pdf': 'pdf',
            'document': 'pdf' // Fallback seguro
        };
        ext = typeMap[record.message_type] || 'bin';
    }
    
    let filename: string = record.file_name || url.split('?')[0].split('/').pop() || 'file';
    
    // Garante que o arquivo tenha extensão válida para o GHL identificar o formato visual
    if (!filename.toLowerCase().endsWith(`.${ext}`)) {
        if (filename.includes('unknown')) {
            filename = filename.replace(/_?unknown/g, '');
        }
        if (!filename) filename = `media_${Date.now()}`;
        filename += `.${ext}`;
    }

    return { url, filename };
}

/**
 * Upload media directly to GHL so it renders correct previews (images/videos instead of generic docs)
 */
async function uploadMediaToGhl(token: string, locationId: string, contactId: string, url: string, filename: string): Promise<string[]> {
    try {
        console.log(`Downloading media for GHL upload: ${filename}`);
        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
        const blob = await fileRes.blob();

        const formData = new FormData();
        formData.append("fileAttachment", blob, filename);
        formData.append("locationId", locationId);
        formData.append("contactId", contactId);

        console.log("Uploading media to GHL...");
        const uploadRes = await fetch(`${GHL_BASE}/conversations/messages/upload`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Version: "2021-04-15"
            },
            body: formData
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`GHL Upload failed (${uploadRes.status}): ${errText}`);
        }

        const data = await uploadRes.json();
        console.log("GHL Upload response:", JSON.stringify(data).substring(0, 150));
        
        if (data.uploadedFiles && Array.isArray(data.uploadedFiles)) {
            // Some versions return array of strings, some return objects { url }
            return data.uploadedFiles.map((f: any) => typeof f === 'string' ? f : f.url).filter(Boolean);
        }
        
        return [];
    } catch (e) {
        console.error("Error in uploadMediaToGhl:", e);
        return [];
    }
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
    locationId: string,
    debugPath?: string[]
): Promise<string | null> {
    try {
        const { data: chat } = await supabase
            .from("chats")
            .select("phone, wa_name, custom_name, is_group, channel")
            .eq("id", chatId)
            .single();

        if (!chat?.phone) {
            console.log("autoCreateGhlContact: No phone for chat", chatId);
            if (debugPath) debugPath.push("auto_create_no_phone");
            return null;
        }

        if (chat.is_group || String(chat.phone).includes("@g.us")) {
            console.log("autoCreateGhlContact: Group chat detected, skipping", chatId);
            if (debugPath) debugPath.push("auto_create_group");
            return null;
        }

        const cleanPhone = String(chat.phone).replace(/\D/g, "");
        if (cleanPhone.length < 10) {
            console.log("autoCreateGhlContact: Invalid phone format, skipping", { chatId, phone: chat.phone });
            if (debugPath) debugPath.push("auto_create_invalid_phone");
            return null;
        }

        const phone = `+${cleanPhone}`;
        const name = chat.custom_name || chat.wa_name || cleanPhone;

        let ghlUserId: string | null = null;
        let connectionInfo: any = null;
        if (chat.channel) {
            // [FIX-2] Two-stage lookup: exact match on instance_name first, then fall back
            // to the org's default connection. This handles multi-connection orgs where
            // chats created via GHL webhook may have channel = orgData.instance_name (legacy)
            // instead of the newer "slug_timestamp" format of a specific connection.
            const { data: exactConn } = await supabase
                .from("whatsapp_connections")
                .select("ghl_user_id, instance_name, display_name")
                .eq("organization_id", orgId)
                .eq("instance_name", chat.channel)
                .maybeSingle();

            if (exactConn) {
                connectionInfo = exactConn;
                if (exactConn.ghl_user_id) ghlUserId = exactConn.ghl_user_id;
            } else {
                // Fallback: use the default connection for this org
                const { data: defaultConn } = await supabase
                    .from("whatsapp_connections")
                    .select("ghl_user_id, instance_name, display_name")
                    .eq("organization_id", orgId)
                    .eq("is_default", true)
                    .maybeSingle();
                if (defaultConn) {
                    connectionInfo = defaultConn;
                    if (defaultConn.ghl_user_id) ghlUserId = defaultConn.ghl_user_id;
                    console.log("[FIX-2] autoCreateGhlContact: channel mismatch, fell back to default connection:", defaultConn.instance_name);
                }
            }
        }

        try {
            const searchResult = await ghlRequest(
                token,
                `/contacts/search/duplicate?locationId=${locationId}&number=${encodeURIComponent(phone)}`
            );

            if (searchResult?.contact?.id) {
                // Determine if this existing GHL contact is ALREADY mapped to a DIFFERENT Vitta Chat
                const { data: existingMapping } = await supabase.from("ghl_sync_mappings")
                    .select("vitta_id")
                    .eq("organization_id", orgId)
                    .eq("resource_type", "contact")
                    .eq("ghl_id", searchResult.contact.id)
                    .maybeSingle();

                if (existingMapping && existingMapping.vitta_id !== chatId) {
                    console.log(`autoCreateGhlContact: GHL contact ${searchResult.contact.id} already mapped to Chat ${existingMapping.vitta_id}. Forcing duplicate creation for Chat ${chatId}.`);
                    if (debugPath) debugPath.push("auto_create_mapped_to_other");
                } else {
                    if (debugPath) debugPath.push("auto_create_found_existing_unmapped");
                    console.log("autoCreateGhlContact: Found existing GHL contact (Unmapped or same):", searchResult.contact.id);
                
                if (ghlUserId && searchResult.contact.assignedTo !== ghlUserId) {
                    try {
                        console.log("autoCreateGhlContact: Updating assignment for existing contact to:", ghlUserId);
                        await ghlRequest(token, `/contacts/${searchResult.contact.id}`, "PUT", { assignedTo: ghlUserId });
                    } catch (e) {
                        console.error("autoCreateGhlContact: Failed to update assignment", e);
                    }
                }

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
                } // End of existing mapping check
            }
        } catch (searchErr) {
            console.log("autoCreateGhlContact: Search failed, creating new:", String(searchErr).substring(0, 120));
            if (debugPath) debugPath.push("auto_create_search_failed");
        }

        let finalName = name;
        let tags: string[] = [];

        if (connectionInfo) {
            const tagStr = connectionInfo.display_name || connectionInfo.instance_name;
            if (tagStr) {
                finalName = `${name} (${tagStr})`;
                tags = [tagStr];
            }
        }

        const contactPayload: any = {
            locationId,
            phone,
            name: finalName,
            firstName: finalName.split(' ')[0], // Add firstName to satisfy GHL bypass requirement
            lastName: finalName.split(' ').slice(1).join(' ') || '.', // Add lastName to satisfy GHL bypass requirement
        };
        if (tags.length > 0) contactPayload.tags = tags;
        if (ghlUserId) contactPayload.assignedTo = ghlUserId;

        const result = await ghlRequest(token, "/contacts/", "POST", contactPayload);

        if (debugPath) debugPath.push(`auto_create_post_res_${Boolean(result?.contact?.id)}`);
        if (result?.contact?.id) {
            console.log("autoCreateGhlContact: Created/Upserted GHL contact:", result.contact.id);
            const { error: mappingErr } = await supabase.from("ghl_sync_mappings").insert({
                organization_id: orgId,
                resource_type: "contact",
                vitta_id: chatId,
                ghl_id: result.contact.id,
            });

            if (mappingErr) {
                console.warn(`autoCreateGhlContact: Mapping Failed (GHL probably merged it because 'Allow Duplicates' is OFF in GHL). Error:`, mappingErr.message);
                console.log(`autoCreateGhlContact: Retrying duplicate creation without native phone to bypass GHL locks...`);
                
                delete contactPayload.phone;
                const fallbackResult = await ghlRequest(token, "/contacts/", "POST", contactPayload);
                
                if (fallbackResult?.contact?.id && fallbackResult.contact.id !== result.contact.id) {
                    console.log("autoCreateGhlContact: Fallback Created GHL contact without phone:", fallbackResult.contact.id);
                    
                    // Add the phone number back now that the duplicate has been isolated
                    try {
                        await ghlRequest(token, `/contacts/${fallbackResult.contact.id}`, "PUT", { phone: phone });
                        console.log("autoCreateGhlContact: Successfully attached phone to duplicate contact.");
                        if (debugPath) debugPath.push("auto_create_put_phone_success");
                    } catch (putErr) {
                        console.error("autoCreateGhlContact: Failed to attach phone to duplicate contact:", putErr);
                        if (debugPath) debugPath.push("auto_create_put_phone_failed");
                    }

                    await supabase.from("ghl_sync_mappings").insert({
                        organization_id: orgId,
                        resource_type: "contact",
                        vitta_id: chatId,
                        ghl_id: fallbackResult.contact.id,
                    });
                    return fallbackResult.contact.id;
                }
                
                console.error("autoCreateGhlContact: Fallback creation failed or returned same ID.");
                if (debugPath) debugPath.push("auto_create_fallback_failed");
                return null;
            }

            return result.contact.id;
        }

        return null;
    } catch (e: any) {
        console.error("autoCreateGhlContact: Fatal error", e);
        try {
            await supabase.from("ghl_sync_logs").insert({
                organization_id: orgId,
                resource_type: "contact",
                resource_id: chatId,
                direction: "vitta_to_ghl",
                status: "error",
                message: `[autoCreateGhlContact Error] Failed to create GHL contact: ${e?.message || String(e)}`,
            });
        } catch (_) {}
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
        const debugPath: string[] = ["start"];
        const orgId = extractOrganization(record);
        if (!orgId) return new Response(JSON.stringify({ ok: true, msg: "No org_id", debugPath }), { headers: corsHeaders });


        const { data: connection, error: connErr } = await supabase.from("ghl_connections").select("*").eq("organization_id", orgId).maybeSingle();
        console.log("GHL connection lookup:", { orgId, found: !!connection, error: connErr?.message });
        if (!connection) { debugPath.push("no_conn"); return new Response(JSON.stringify({ ok: true, msg: "No GHL connection for org " + orgId, debugPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

        const { data: config, error: cfgErr } = await supabase.from("ghl_global_config").select("*").limit(1).single();
        console.log("GHL global config:", { found: !!config, error: cfgErr?.message });
        if (!config) { debugPath.push("no_cfg"); return new Response(JSON.stringify({ ok: true, msg: "No GHL config", debugPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

        debugPath.push("got_config_and_conn");

        const token = await refreshTokenIfNeeded(supabase, connection, config);
        const conversationProviderId = await resolveConversationProviderId(supabase, connection);

        if (table === "messages") {
            debugPath.push("table_messages");
            if (record.sync_source === "ghl") {
                debugPath.push("skip_ghl");
                return new Response(JSON.stringify({ ok: true, msg: "Skipped GHL source", debugPath }), { headers: corsHeaders });
            }

            // [FIX-1] Idempotency check: if this exact message was already synced successfully, skip.
            if (record.id) {
                const { data: existingLog } = await supabase
                    .from("ghl_sync_logs")
                    .select("id")
                    .eq("resource_id", record.id)
                    .eq("resource_type", "message")
                    .eq("status", "success")
                    .maybeSingle();
                if (existingLog) {
                    debugPath.push("idempotency_skip");
                    return new Response(JSON.stringify({ ok: true, msg: "Already synced", debugPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            }

            let { data: chatMapping, error: mapErr } = await supabase.from("ghl_sync_mappings")
                .select("ghl_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id).maybeSingle();

            console.log("Message sync - contact mapping:", { chat_id: record.chat_id, ghl_contact_id: chatMapping?.ghl_id, error: mapErr?.message });

            if (chatMapping?.ghl_id) {
                // Self-healing: if this GHL contact is shared by multiple Vitta Chats (cross-connection bleed), break the chain!
                const { data: sharedMappings } = await supabase.from("ghl_sync_mappings")
                    .select("vitta_id").eq("organization_id", orgId).eq("resource_type", "contact").eq("ghl_id", chatMapping.ghl_id);

                if (sharedMappings && sharedMappings.length > 1) {
                    console.log(`[Self-Healing] ghl_id ${chatMapping.ghl_id} is shared by ${sharedMappings.length} chats! Breaking chain for chat ${record.chat_id} to force duplicate isolation.`);
                    await supabase.from("ghl_sync_mappings").delete().eq("organization_id", orgId).eq("resource_type", "contact").eq("vitta_id", record.chat_id);
                    chatMapping = null;
                }
            }

            // Fetch the chat details including channel
            const { data: chat } = await supabase
                .from("chats")
                .select("channel")
                .eq("id", record.chat_id)
                .single();

            // Auto-create GHL contact if mapping doesn't exist
            if (!chatMapping?.ghl_id && connection.location_id) {
                debugPath.push("auto_create_contact");
                const ghlContactId = await autoCreateGhlContact(
                    supabase, token, orgId, record.chat_id, connection.location_id, debugPath
                );
                if (ghlContactId) {
                    debugPath.push("auto_create_success");
                    chatMapping = { ghl_id: ghlContactId };
                } else {
                    debugPath.push("auto_create_null");
                }
            }

            if (chatMapping?.ghl_id) {
                debugPath.push("has_chat_mapping");
                // Ensure assignedTo is set on the GHL Contact, even if it already existed
                if (chat?.channel) {
                    // [FIX-2] Two-stage lookup: exact instance_name, then default connection
                    supabase.from("whatsapp_connections")
                        .select("ghl_user_id")
                        .eq("organization_id", orgId)
                        .eq("instance_name", chat.channel)
                        .maybeSingle()
                        .then(async ({ data: exactWaConn }) => {
                            const waConn = exactWaConn ?? await supabase
                                .from("whatsapp_connections")
                                .select("ghl_user_id")
                                .eq("organization_id", orgId)
                                .eq("is_default", true)
                                .maybeSingle()
                                .then(({ data }) => data);
                            if (waConn?.ghl_user_id) {
                                // Background fire-and-forget to update assignment
                                ghlRequest(token, `/contacts/${chatMapping.ghl_id}`, "PUT", { assignedTo: waConn.ghl_user_id })
                                    .catch(e => console.error("Silent background assignment update failed:", e));
                            }
                        }).catch(() => {});
                }

                const isMarketplaceChannel = !!conversationProviderId;
                // is_from_user=true means agent sent it (outbound from platform)
                // is_from_user=false means lead sent it (inbound from WhatsApp)
                const direction = record.is_from_user ? "outbound" : "inbound";

                const messageText = buildMessageText(record);
                
                // [FIX MEDIA] Upload file to GHL first to get a native GHL URL so previews render
                const attachmentInfo = getAttachmentInfo(record);
                let ghlAttachmentUrls: string[] = [];
                
                if (attachmentInfo) {
                    const uploadedUrls = await uploadMediaToGhl(
                        token,
                        connection.location_id,
                        chatMapping.ghl_id,
                        attachmentInfo.url,
                        attachmentInfo.filename
                    );
                    
                    if (uploadedUrls && uploadedUrls.length > 0) {
                        ghlAttachmentUrls = uploadedUrls;
                    } else {
                        console.warn("GHL Upload failed or returned empty. Falling back to Vitta direct URL (might show as document).");
                        ghlAttachmentUrls = [attachmentInfo.url];
                    }
                }

                const attachments = ghlAttachmentUrls;

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

                    try {
                        return await ghlRequest(token, "/conversations/messages", "POST", payload);
                    } catch (e) {
                        // Desperate fallback for outbound: strip attachments if API rejected them (common with SMS MMS limits)
                        if (payload.attachments && payload.attachments.length > 0) {
                            console.warn("GHL API rejected outbound message with attachments. Retrying purely as text.", String(e));
                            delete payload.attachments;
                            return await ghlRequest(token, "/conversations/messages", "POST", payload);
                        }
                        throw e;
                    }
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
                            ...(attachments.length > 0 ? { attachments } : {}),
                        },
                        idempotencyKey: record.id,
                    };
                    // Also include at top-level for compatibility with different GHL endpoint versions
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
                        attachmentsStr: attachments.join(','),
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
                                const errData = endpointErr?.response ? JSON.stringify(endpointErr.response) : "";
                                console.error(`Inbound attempt ${attempt.endpoint} failed:` + errMessage + errData);
                            }
                        }

                        if (!inboundResult && attachments.length > 0) {
                            console.warn("GHL API rejected inbound message with attachments. Retrying purely as text.");
                            const errMsg = lastInboundErr ? (lastInboundErr as any).message || String(lastInboundErr) : "Erro desconhecido";
                            const errSuffix = `\n\n[❗ Erro GHL ao processar anexo: ${errMsg.substring(0, 200)}]`;
                            
                            for (const attempt of inboundAttempts) {
                                delete attempt.payload.attachments;
                                attempt.payload.idempotencyKey = `${record.id}_fb`;
                                if (attempt.payload.message) attempt.payload.message += errSuffix;
                                if (attempt.payload.content && attempt.payload.content.text) attempt.payload.content.text += errSuffix;
                                
                                try {
                                    inboundResult = await ghlRequest(token, attempt.endpoint, "POST", attempt.payload);
                                    console.log("GHL inbound message fallback sent successfully:", {
                                        endpoint: attempt.endpoint,
                                        result: JSON.stringify(inboundResult).substring(0, 200),
                                    });
                                    break;
                                } catch (endpointErr) {
                                    lastInboundErr = endpointErr;
                                }
                            }
                        }

                        if (!inboundResult) {
                            // [FIX-2] Do NOT send as outbound fallback — that would invert the conversation
                            // in GHL, making lead messages appear as if sent by the agent.
                            // Instead, log the error and move on. The message is safe in Vitta's DB.
                            const lastErrStr = lastInboundErr
                                ? (lastInboundErr as any)?.message || String(lastInboundErr)
                                : "Unknown error";
                            await supabase.from("ghl_sync_logs").insert({
                                organization_id: orgId,
                                resource_type: "message",
                                resource_id: record.id ?? null,
                                direction: "vitta_to_ghl",
                                status: "error",
                                message: `[FIX-2] All GHL inbound endpoints failed. Message kept in Vitta only. Last error: ${lastErrStr.substring(0, 400)}`,
                            });
                            console.warn(`[FIX-2] All GHL inbound endpoints failed for message ${record.id}. NOT sending as outbound to avoid inverting conversation. Error:`, lastErrStr.substring(0, 200));
                            // Return gracefully — do not throw. The message exists in Vitta.
                            debugPath.push("inbound_fail_graceful");
                            return new Response(JSON.stringify({ ok: true, msg: "Inbound sync failed gracefully — message preserved in Vitta", debugPath }), {
                                headers: { ...corsHeaders, "Content-Type": "application/json" },
                            });
                        } else {
                            debugPath.push("inbound_success");
                            // [FIX-1] Record successful sync for idempotency deduplication
                            await supabase.from("ghl_sync_logs").insert({
                                organization_id: orgId,
                                resource_type: "message",
                                resource_id: record.id ?? null,
                                direction: "vitta_to_ghl",
                                status: "success",
                                message: "Successfully pushed inbound message to GHL",
                            });
                        }

                        return new Response(JSON.stringify({ ok: true, data: inboundResult, debugPath }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    } catch (inboundErr) {
                        debugPath.push("inbound_catch");
                        // [FIX-2] All inbound endpoints failed — log and preserve message in Vitta only.
                        // Do NOT send as outbound — that would invert the conversation in GHL.
                        const errStr = String(inboundErr).substring(0, 400);
                        console.warn(`[FIX-2] Caught final inbound error for message ${record.id}. Logging and returning gracefully.`, errStr);
                        await supabase.from("ghl_sync_logs").insert({
                            organization_id: orgId,
                            resource_type: "message",
                            resource_id: record.id ?? null,
                            direction: "vitta_to_ghl",
                            status: "error",
                            message: `[FIX-2] Inbound sync failed — message preserved in Vitta only. Error: ${errStr}`,
                        });
                        return new Response(JSON.stringify({ ok: true, msg: "Inbound sync error — message preserved in Vitta", debugPath }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }
                } else {
                    debugPath.push("outbound_start");
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

                    // [FIX-1] Record successful outbound sync for idempotency deduplication
                    if (record.id) {
                        await supabase.from("ghl_sync_logs").insert({
                            organization_id: orgId,
                            resource_type: "message",
                            resource_id: record.id,
                            direction: "vitta_to_ghl",
                            status: "success",
                            message: "Successfully pushed outbound message to GHL",
                        });
                    }
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

        debugPath.push("end_of_function");
        return new Response(JSON.stringify({ ok: true, debugPath }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (globalError: any) {
        console.error("Global crash in ghl-outbound-sync:", globalError);
        
        // Try to initialize a client in an emergency just to log the error
        try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseKey);
            if (orgId) {
                await supabase.from("ghl_sync_logs").insert({
                    organization_id: orgId,
                    status: "error",
                    message: `[FATAL EXCEPTION] ghl-outbound-sync crashed: ${globalError?.message || String(globalError)}`,
                });
            }
        } catch (e) {}

        return new Response(JSON.stringify({ error: String(globalError) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
