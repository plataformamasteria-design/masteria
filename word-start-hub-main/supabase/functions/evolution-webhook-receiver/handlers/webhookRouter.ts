import { extractAdTrackingData } from '../services/adTracker.ts';
import { handleMessageUpdate, handleMessageDelete, detectMessageType, mapMessageType, extractTextContent, extractMentionedJidsFromPayload, isLidToken, resolveLidMentionsInText, resolveLidMentionsWithFallback, unwrapMessage, tryHandleProtocolMessage, extractQuotedExternalMessageId, uniqStrings, findFirstQuotedIdInMessage, findMessageByExternalIds, extractQuotedPreviewFromPayload, getMimeType, getFileName, getEvolutionConfig, fetchProfilePicture, fetchGroupInfo, normalizeDigits, isLidFormat, looksLikeRealPhone, resolveRealPhoneFromGroupInfo, updateGroupParticipantFromMessage, syncGroupParticipantsSnapshot, resolveOrganizationForWebhook, extractGroupJidFromEvent, handleGroupEvent, getBase64FromMedia, addLeadFrioTag, addAdTag, cleanEvolutionData, dispatchReceivedWebhook } from './webhookLogic.ts';

import { EvolutionApiConfig, MessageData, QuotedPreview, ALLOWED_INTERNAL_MESSAGE_TYPES } from '../types.ts';
import { maybeSendAutoMessages } from '../services/autoResponder.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { uploadToR2 } from '../../_shared/r2-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const WebhookPayloadSchema = z.object({
  instance: z.string().optional(),
  event: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
      id: z.string(),
      participant: z.string().optional(),
      participantAlt: z.string().optional()
    }).passthrough().optional(),
    pushName: z.string().nullable().optional(),
    messageType: z.string().optional(),
    message: z.any().optional()
  }).passthrough().optional()
}).passthrough();





function dispatchJob(supabaseUrl: string, key: string, jobId: string) {
  const url = `${supabaseUrl}/functions/v1/automation-executor`;
  const promise = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ background_job_id: jobId })
  }).then(res => {
    if (!res.ok) console.error("Job dispatch failed:", res.status);
  }).catch(e => console.error("Job dispatch error:", e));

  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
    (globalThis as any).EdgeRuntime.waitUntil(promise);
  }
}

export async function handleEvolutionWebhook(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const instanceParamUrl = url.searchParams.get('instance');
    const organizationIdParam = url.searchParams.get('organization_id');

    // Parse body first so we can extract instance if missing from URL
    const rawBody = await req.json();
    const payloadInstance = rawBody?.instance || rawBody?.instanceName || null;
    
    // IMPORTANT: Payload instance is the absolute source of truth. URL param is fallback for legacy setups.
    // If we use URL param first, a global webhook (e.g. ?instance=gestpro) will hijack ALL messages.
    const instanceParam = payloadInstance || instanceParamUrl || null;

    console.log('[evolution-webhook-receiver] Received webhook');
    console.log('[evolution-webhook-receiver] Instance param resolved:', instanceParam);
    console.log('[evolution-webhook-receiver] Organization ID param:', organizationIdParam);

    const parsed = WebhookPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error('[evolution-webhook-receiver] Zod payload rejection:', parsed.error);
      return new Response(JSON.stringify({ error: 'Invalid payload structure', details: parsed.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = parsed.data;
    const eventType = body.event?.toUpperCase() || '';
    console.log('[evolution-webhook-receiver] Event:', eventType);

    // Handle different event types
    if (eventType === 'MESSAGES_UPDATE' || eventType === 'MESSAGES.UPDATE') {
      return await handleMessageUpdate(supabase, body, instanceParam, organizationIdParam);
    }

    if (eventType === 'MESSAGES_DELETE' || eventType === 'MESSAGES.DELETE') {
      return await handleMessageDelete(supabase, body, instanceParam, organizationIdParam);
    }

    // Group events (keep group metadata + participants in sync even without new messages)
    if (
      eventType === 'GROUPS_UPSERT' ||
      eventType === 'GROUPS.UPSERT' ||
      eventType === 'GROUP_UPDATE' ||
      eventType === 'GROUP.UPDATE' ||
      eventType === 'GROUP_PARTICIPANTS_UPDATE' ||
      eventType === 'GROUP_PARTICIPANTS.UPDATE'
    ) {
      return await handleGroupEvent(supabase, body, instanceParam, organizationIdParam);
    }

    // Only process these events
    if (eventType !== 'MESSAGES.UPSERT' && eventType !== 'MESSAGES_UPSERT' && eventType !== 'CONNECTION.UPDATE' && eventType !== 'CONNECTION_UPDATE') {
      console.log('[evolution-webhook-receiver] Ignoring event:', eventType);
      return new Response(
        JSON.stringify({ ignored: true, reason: 'not_supported_event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve organization
    let organizationId: string | null = organizationIdParam;
    let organization: any = null;

    if (!organizationId && instanceParam) {
      // Resolve by instance_name - handle potential duplicates gracefully
      const { data: orgsMatching, error } = await supabase
        .from('organizations')
        .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings, updated_at')
        .eq('instance_name', instanceParam);

      if (!error && orgsMatching && orgsMatching.length === 1) {
        // Exact match - single organization found
        organization = orgsMatching[0];
        organizationId = orgsMatching[0].id;
        console.log('[evolution-webhook-receiver] Resolved by instance_name (unique):', organization.slug, organizationId);
      } else if (!error && orgsMatching && orgsMatching.length > 1) {
        // Multiple orgs with same instance_name - use most recently updated
        console.warn('[evolution-webhook-receiver] Multiple organizations with same instance_name:', instanceParam, 'count:', orgsMatching.length);
        const sorted = orgsMatching.sort((a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        organization = sorted[0];
        organizationId = sorted[0].id;
        console.log('[evolution-webhook-receiver] Using most recently updated org:', organization.slug, organizationId);
      } else {
        // Fallback: try by slug (case where instance_name is actually the slug)
        const { data: orgBySlug, error: slugError } = await supabase
          .from('organizations')
          .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
          .eq('slug', instanceParam)
          .maybeSingle();

        if (!slugError && orgBySlug) {
          organization = orgBySlug;
          organizationId = orgBySlug.id;
          console.log('[evolution-webhook-receiver] Resolved by slug:', organization.slug, organizationId);
        } else {
          // Fallback 2: try by whatsapp_connections table (multi-channel support)
          const { data: connItem, error: connErr } = await supabase
            .from('whatsapp_connections')
            .select('organization_id')
            .eq('instance_name', instanceParam)
            .maybeSingle();

          if (!connErr && connItem) {
            organizationId = connItem.organization_id;

            // We must still load the organization object since later logic relies on it
            const { data: orgById } = await supabase
              .from('organizations')
              .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
              .eq('id', organizationId)
              .single();

            if (orgById) {
              organization = orgById;
              console.log('[evolution-webhook-receiver] Resolved by whatsapp_connections:', organization.slug, organizationId);
            }
          } else {
            console.error('[evolution-webhook-receiver] Could not resolve organization by instance, slug or whatsapp_connections:', instanceParam);
          }
        }
      }
    } else if (organizationId) {
      const { data: orgById } = await supabase
        .from('organizations')
        .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
        .eq('id', organizationId)
        .single();

      if (orgById) {
        organization = orgById;
      }
    }

    if (!organizationId || !organization) {
      console.error('[evolution-webhook-receiver] Could not resolve organization');
      return new Response(
        JSON.stringify({ error: 'Could not resolve organization from instance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[evolution-webhook-receiver] Resolved organization:', organization.slug, organizationId);

    if (eventType === 'CONNECTION_UPDATE' || eventType === 'CONNECTION.UPDATE') {
      const state = body.data?.state || body.data?.instance?.state;
      const statusReason = body.data?.statusReason || body.data?.reason;

      let whatsappStatus = 'connected';
      if (state === 'close' || state === 'disconnected' || state === 'refused') {
        whatsappStatus = 'disconnected';
      } else if (state === 'connecting') {
        whatsappStatus = 'connecting';
      } else if (state === 'open') {
        whatsappStatus = 'connected';
      }

      const currentSettings = organization.settings || {};
      currentSettings.whatsapp_connection = {
        status: whatsappStatus,
        last_seen: new Date().toISOString(),
        reason: statusReason
      };

      await supabase.from('organizations')
        .update({ settings: currentSettings })
        .eq('id', organizationId);

      console.log(`[evolution-webhook-receiver] 🚨 Connection updated to ${whatsappStatus} for ${organization.slug}`);
      return new Response(JSON.stringify({ success: true, action: 'connection_updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auto-assignment config (stored in organizations.settings.auto_assignment)
    const autoAssignment = organization?.settings?.auto_assignment ?? null;
    const autoAssignEnabled = !!autoAssignment?.enabled && !!autoAssignment?.team_id;
    const autoAssignTeamId: string | null = autoAssignEnabled ? autoAssignment.team_id : null;

    // Dynamic distribution config (stored in organizations.settings.dynamic_distribution)
    const dynamicDistribution = organization?.settings?.dynamic_distribution ?? null;
    const dynamicEnabled = !!dynamicDistribution?.enabled;
    const dynamicTeamId: string | null = dynamicDistribution?.assignment_target?.team_id ?? null;
    const dynamicIncludeOnlyOnline: boolean = dynamicDistribution?.include_only_online ?? true;
    const dynamicOnlineCutoffMs = 2 * 60 * 1000;

    async function pickAgentLeastOpenChats(params: {
      organizationId: string;
      teamId: string;
    }): Promise<string | null> {
      const { organizationId, teamId } = params;
      try {
        // Approved agents in org
        const { data: approvedAgents, error: agentsErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('approved', true);
        if (agentsErr) throw agentsErr;
        const approvedSet = new Set((approvedAgents || []).map((r: any) => String(r.id)));

        // Team members
        const { data: members, error: membersErr } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('team_id', teamId);
        if (membersErr) throw membersErr;
        const memberIds = (members || []).map((r: any) => String(r.user_id)).filter((id: string) => approvedSet.has(id));
        if (!memberIds.length) return null;

        let candidateIds = memberIds;

        if (dynamicIncludeOnlyOnline) {
          const cutoffIso = new Date(Date.now() - dynamicOnlineCutoffMs).toISOString();
          const { data: pres, error: presErr } = await supabase
            .from('user_presence')
            .select('user_id,last_seen_at')
            .eq('organization_id', organizationId)
            .gte('last_seen_at', cutoffIso);
          if (presErr) throw presErr;
          const onlineSet = new Set((pres || []).map((r: any) => String(r.user_id)));
          candidateIds = candidateIds.filter((id: string) => onlineSet.has(id));
        }

        if (!candidateIds.length) return null;

        // Count open chats per agent
        const load = new Map<string, number>();
        candidateIds.forEach((id: string) => load.set(id, 0));
        const { data: openChats, error: chatsErr } = await supabase
          .from('chats')
          .select('assigned_to')
          .eq('organization_id', organizationId)
          .is('resolved_at', null)
          .in('assigned_to', candidateIds);
        if (chatsErr) throw chatsErr;

        for (const row of openChats || []) {
          const id = row.assigned_to ? String(row.assigned_to) : null;
          if (!id) continue;
          load.set(id, (load.get(id) || 0) + 1);
        }

        // pick least loaded (random tie-break)
        let min = Number.POSITIVE_INFINITY;
        let picks: string[] = [];
        for (const [id, count] of load.entries()) {
          if (count < min) {
            min = count;
            picks = [id];
          } else if (count === min) {
            picks.push(id);
          }
        }
        if (!picks.length) return null;
        return picks[Math.floor(Math.random() * picks.length)];
      } catch (e) {
        console.log('[evolution-webhook-receiver] [DYNAMIC] pickAgentLeastOpenChats failed:', e);
        return null;
      }
    }

    // Extract message data from Evolution payload
    const data = body.data;
    const key = data?.key;

    if (!key) {
      console.error('[evolution-webhook-receiver] No key in message data');
      return new Response(
        JSON.stringify({ error: 'Invalid message format - no key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatId = key.remoteJid;
    const isGroup = chatId?.endsWith('@g.us') || false;
    const phone = isGroup ? chatId : chatId?.split('@')[0];
    const fromMe = key.fromMe || false;
    const messageKeyId = key.id;
    const pushName = data.pushName || null;

    // For groups, extract sender info
    // NOTE: WhatsApp now sends LIDs (Linked IDs like "12345@lid") in `key.participant`
    // but the REAL phone number is in `key.participantAlt` (e.g., "558892161399@s.whatsapp.net")
    // ALWAYS prefer participantAlt when available!
    let senderPhone: string | null = null;
    let senderName: string | null = null;
    let senderJid: string | null = null;
    if (isGroup) {
      // PRIORITY: Use participantAlt (contains real phone like "558892161399@s.whatsapp.net")
      const participantAlt = key.participantAlt || null;
      const participantRaw = key.participant || null;

      // Set JID (prefer participantAlt as it's the real identifier for contacts)
      if (participantAlt && String(participantAlt).includes('@s.whatsapp.net')) {
        senderJid = String(participantAlt).trim();
        // Extract real phone number from participantAlt (e.g., "558892161399@s.whatsapp.net" -> "558892161399")
        const altPhone = senderJid.split('@')[0].replace(/\D/g, '');
        if (looksLikeRealPhone(altPhone)) {
          senderPhone = altPhone;
        }
      } else if (participantRaw) {
        // Fallback to participant if participantAlt not available
        senderJid = String(participantRaw).trim();
        const isLid = isLidFormat(senderJid);

        // Only extract phone from participant if it's NOT a LID
        if (!isLid) {
          const participantPart = senderJid.split('@')[0].replace(/\D/g, '');
          if (looksLikeRealPhone(participantPart)) {
            senderPhone = participantPart;
          }
        }
        // If it's a LID, senderPhone stays null - will be resolved from groupInfo later
      }

      senderName = pushName;

      console.log('[evolution-webhook-receiver] [GROUP] participantAlt:', participantAlt, 'participant:', participantRaw, 'resolvedPhone:', senderPhone, 'pushName:', pushName);
    }

    // Detect message type and extract content
    const rawMessage = data.message || {};
    const message = unwrapMessage(rawMessage);

    // Fallback: some builds deliver edits/deletes as UPSERT protocol messages
    const protocol = message?.protocolMessage;
    if (protocol) {
      const handled = await tryHandleProtocolMessage(supabase, protocol, organizationId);
      if (handled) {
        return new Response(
          JSON.stringify({ success: true, action: handled.action, message_id: handled.message_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const messageType = data.messageType || detectMessageType(message);
    let content = extractTextContent(message, messageType);

    // Extract mentionedJid from contextInfo to resolve LID mentions to real phones
    const mentionedJids = extractMentionedJidsFromPayload(message, rawMessage, data);
    if (content && mentionedJids.length > 0) {
      content = resolveLidMentionsInText(content, mentionedJids);
    }

    // -----> REACTION INTERCEPTOR <-----
    const rxMsg = data?.message?.reactionMessage || message?.reactionMessage;
    if (rxMsg) {
      const targetMessageExternalId = rxMsg?.key?.id;
      const emoji = rxMsg?.text || ''; // empty means reaction removed
      const participant = senderJid || phone || 'unknown'; // Person who reacted

      console.log(`[evolution-webhook-receiver] Intercepted Reaction: [${emoji}] for msg ${targetMessageExternalId} by ${participant}`);

      if (targetMessageExternalId) {
        const targetMsg = await findMessageByExternalIds(supabase, [String(targetMessageExternalId)], organizationId);
        if (targetMsg) {
          try {
            const { data: currentMsg, error: rErr } = await supabase
              .from('messages')
              .select('reactions')
              .eq('id', targetMsg.id)
              .maybeSingle();

            if (!rErr && currentMsg) {
              let existingReactions: Array<{ emoji: string, participant: string }> = Array.isArray(currentMsg.reactions) ? currentMsg.reactions : [];

              // Remove any existing reaction from this participant
              existingReactions = existingReactions.filter(r => r.participant !== participant);

              // If emoji is not empty, add the new reaction
              if (emoji) {
                existingReactions.push({ emoji, participant });
              }

              const { error: updErr } = await supabase
                .from('messages')
                .update({ reactions: existingReactions })
                .eq('id', targetMsg.id);

              if (updErr) console.error('[evolution-webhook-receiver] Failed to update reactions JSONB:', updErr);
              else console.log(`[evolution-webhook-receiver] ✅ Reaction applied to ${targetMsg.id}`);
            }
          } catch (e) {
            console.error('[evolution-webhook-receiver] Error applying reaction (possibly missing column):', e);
          }
        } else {
          console.log(`[evolution-webhook-receiver] Target message ${targetMessageExternalId} not found for reaction.`);
        }
      }

      return new Response(JSON.stringify({ success: true, action: 'reaction_processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract quoted info (stanzaId) from payload
    // Some builds place quoted metadata outside the unwrapped message;
    // we try a couple of bounded fallbacks.
    const quotedExternalId =
      extractQuotedExternalMessageId(message) ||
      findFirstQuotedIdInMessage(rawMessage) ||
      findFirstQuotedIdInMessage(data) ||
      null;
    const quotedPreviewFromPayload = extractQuotedPreviewFromPayload(message);

    console.log('[evolution-webhook-receiver] Message type:', messageType);
    console.log('[evolution-webhook-receiver] From:', phone);
    console.log('[evolution-webhook-receiver] From me:', fromMe);
    console.log('[evolution-webhook-receiver] Is group:', isGroup);

    // -----> Ad Tracking (Click To WhatsApp) Extraction <-----
    const adData = await extractAdTrackingData({
      supabase, organizationId, message, data, content, fromMe, messageType
    });
    let { adId, sourceUrl, adsetId, campaignId, adName, campaignName } = adData;

    // Check for duplicate message FIRST (before ignoring fromMe)
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('external_message_id', messageKeyId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existingMessage) {
      console.log('[evolution-webhook-receiver] Duplicate message, skipping:', messageKeyId);
      return new Response(
        JSON.stringify({ ignored: true, reason: 'duplicate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback Deduplication for Echos (fromMe: true)
    // Se a mensagem foi enviada pela plataforma há menos de 60s e o ID ainda não foi gravado
    if (fromMe) {
      const windowAgo = new Date(Date.now() - 60000).toISOString();
      const targetPhone = isGroup ? chatId : phone;
      try {
        // Allow matching GHL messages that were just inserted and have their idempotency key in external_message_id
        const { data: recentPending } = await supabase
          .from('messages')
          .select('id, content')
          .eq('organization_id', organizationId)
          .eq('is_from_user', true)
          .gte('created_at', windowAgo)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentPending && recentPending.length > 0) {
          const matchedPending = recentPending.find((m: any) => m.content === content);
          
          if (matchedPending) {
            console.log('[evolution-webhook-receiver] Found recent pending message matching echo EXACTLY. Updating ID and skipping insert:', matchedPending.id);
            // Atualiza a mensagem existente com o ID retornado pro eco
            await supabase
              .from('messages')
              .update({ external_message_id: messageKeyId })
              .eq('id', matchedPending.id);

            return new Response(
              JSON.stringify({ ignored: true, reason: 'matched_pending_echo', matched_id: matchedPending.id }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            console.log('[evolution-webhook-receiver] Found recent pending messages, but NO EXACT MATCH for content. This is a genuine cell phone message.');
          }
        }
      } catch (dedupeErr) {
        console.error('[evolution-webhook-receiver] Dedupe error:', dedupeErr);
      }
    }

    // Get Evolution API config
    const evolutionConfig = await getEvolutionConfig(supabase, organization, instanceParam);

    // Fetch or create chat
    const currentChannel = instanceParam || organization.instance_name || null;
    let chatQuery = supabase
      .from('chats')
      .select('*')
      .eq('phone', isGroup ? chatId : phone)
      .eq('organization_id', organizationId);

    // Strict channel filtering guarantees Vitta treats the same customer as separate chats
    // if they start messaging a different WhatsApp instance.
    // Groups are globally unique by JID, so we don't isolate them by channel.
    if (currentChannel && !isGroup) {
      chatQuery = chatQuery.eq('channel', currentChannel);
    }

    // Use .order().limit(1) instead of .maybeSingle() to avoid errors when
    // duplicate chats exist (race condition from parallel webhooks)
    const { data: existingChats, error: existingChatErr } = await chatQuery
      .order('created_at', { ascending: true })
      .limit(1);

    if (existingChatErr) {
      console.error('[evolution-webhook-receiver] Error fetching existing chat:', existingChatErr);
    }

    let chat = existingChats && existingChats.length > 0 ? existingChats[0] : null;

    let isNewChat = false;

    // Fetch profile picture and group info if needed
    let profilePictureUrl: string | null = null;
    let groupInfo: any = null;

    if (evolutionConfig) {
      // For groups, ALWAYS fetch photo and info on every message to keep it updated
      if (isGroup) {
        groupInfo = await fetchGroupInfo(evolutionConfig, chatId);
        profilePictureUrl = await fetchProfilePicture(evolutionConfig, chatId);
        console.log('[evolution-webhook-receiver] Fetched group photo:', profilePictureUrl ? 'success' : 'null');
        console.log('[evolution-webhook-receiver] Fetched group info:', groupInfo ? 'success' : 'null');

        // Try to resolve real phone number if we have a LID
        if (isLidFormat(senderJid) && groupInfo) {
          const resolved = resolveRealPhoneFromGroupInfo({ senderJid, senderName, groupInfo });
          if (resolved.phone) {
            senderPhone = resolved.phone;
            console.log('[evolution-webhook-receiver] [LID-RESOLVE] Updated senderPhone from LID to:', senderPhone);
          }
          if (resolved.name && !senderName) {
            senderName = resolved.name;
          }
        }
      } else {
        // For individual chats, only fetch if missing
        if (!chat || !chat.wa_photo_url) {
          profilePictureUrl = await fetchProfilePicture(evolutionConfig, phone);
          console.log('[evolution-webhook-receiver] Fetched profile photo:', profilePictureUrl ? 'success' : 'null');
        }
      }
    }

    let updateDataForChat: any = null;

    if (!chat) {
      // Create new chat
      isNewChat = true;
      const chatData: any = {
        phone: isGroup ? chatId : phone,
        organization_id: organizationId,
        channel: instanceParam || organization.instance_name || null,
        is_group: isGroup,
        wa_name: isGroup ? (groupInfo?.subject || 'Grupo') : (!fromMe ? pushName : null),
        wa_photo_url: profilePictureUrl,
        last_message: content?.substring(0, 100) || '',
        last_message_at: new Date().toISOString(),
        ad_id: adId || null,
        adset_id: adsetId || null,
        campaign_id: campaignId || null,
        ad_name: adName || null,
        campaign_name: campaignName || null,
      };

      // Team + agent assignment for incoming lead messages
      if (!fromMe) {
        const targetTeamId = (dynamicEnabled && dynamicTeamId) ? dynamicTeamId : autoAssignTeamId;
        if (targetTeamId) {
          chatData.team_id = targetTeamId;
          chatData.assigned_at = new Date().toISOString();
        }
        if (dynamicEnabled && targetTeamId) {
          const pick = await pickAgentLeastOpenChats({ organizationId, teamId: targetTeamId });
          if (pick) {
            chatData.assigned_to = pick;
            chatData.assigned_at = new Date().toISOString();
          }
        }
      }

      if (isGroup) {
        chatData.group_name = groupInfo?.subject || 'Grupo';
        chatData.group_photo_url = profilePictureUrl;
        chatData.participant_count = groupInfo?.size || null;
      }

      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert(chatData)
        .select()
        .maybeSingle();

      if (chatError) {
        if (chatError.code === '23505' || (chatError.message && chatError.message.includes('duplicate key'))) {
          console.log('[evolution-webhook-receiver] Race condition caught (unique_violation). Re-fetching chat...');
          const { data: concChat, error: concErr } = await supabase
            .from('chats')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('phone', isGroup ? chatId : phone)
            .eq('channel', instanceParam || organization.instance_name || 'whatsapp')
            .limit(1)
            .single();
            
          if (concErr || !concChat) {
            console.error('[evolution-webhook-receiver] Error re-fetching duplicated chat:', concErr);
            throw chatError;
          }
          chat = concChat;
          isNewChat = false; 
        } else {
          console.error('[evolution-webhook-receiver] Error creating chat:', chatError);
          throw chatError;
        }
      } else {
        chat = newChat;
        console.log('[evolution-webhook-receiver] Created new chat:', chat.id);
      }

      // Auto-assign new lead to funnel/stage if configured
      if (!isGroup && !fromMe) {
        const autoFunnelEnabled = organization?.settings?.auto_assign_funnel_enabled;
        const autoFunnelId = organization?.settings?.auto_assign_funnel_id;
        const autoStageId = organization?.settings?.auto_assign_stage_id;
        if (autoFunnelEnabled && autoFunnelId && autoStageId) {
          try {
            await supabase.from('chat_funnel_stage').insert({
              chat_id: chat.id,
              funnel_id: autoFunnelId,
              stage_id: autoStageId,
              organization_id: organizationId,
            });
            console.log('[evolution-webhook-receiver] Auto-assigned new lead to funnel:', autoFunnelId, 'stage:', autoStageId);
          } catch (e) {
            console.log('[evolution-webhook-receiver] Auto-assign funnel failed:', e);
          }
        }
      }

      // Sync group participants snapshot
      if (isGroup && groupInfo) {
        await syncGroupParticipantsSnapshot(supabase, organizationId, chat.id, groupInfo);
      }
    } else {
      // Update existing chat
      const isMsgHidden = !!existingMessage?.is_hidden_from_agents || (fromMe && chat?.last_message === "🔒 Mensagem Oculta");
      const finalLastMessage = isMsgHidden
        ? "🔒 Mensagem Oculta"
        : (content?.substring(0, 100) || (messageType !== 'text' ? `[${messageType}]` : ''));

      const updateData: any = {
        last_message: finalLastMessage,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if ((adId || sourceUrl || campaignId) && !fromMe) {
        if (adId) updateData.ad_id = adId;
        if (campaignId) updateData.campaign_id = campaignId;
        if (campaignName) updateData.campaign_name = campaignName;
        if (adsetId) updateData.adset_id = adsetId;
        if (adName) updateData.ad_name = adName;
      }

      // If lead sends a new message, re-open resolved/hidden chat and apply default team if missing
      if (!fromMe) {
        updateData.last_inbound_at = new Date().toISOString();
        // If the chat was explicitly hidden from Chat lists, unhide it on new inbound lead messages
        if ((chat as any).hidden_from_chat) {
          updateData.hidden_from_chat = false;
          updateData.resolved_at = null;
          updateData.resolved_by = null;
        } else if (chat.resolved_at) {
          updateData.resolved_at = null;
          updateData.resolved_by = null;
        }

        const targetTeamId = (dynamicEnabled && dynamicTeamId) ? dynamicTeamId : autoAssignTeamId;
        // "Sempre que sem equipe" -> define equipe alvo
        if (!chat.team_id && targetTeamId) {
          updateData.team_id = targetTeamId;
          updateData.assigned_at = new Date().toISOString();
        }

        // Se estiver sem agente, atribuir dinamicamente
        const finalTeamId = (updateData.team_id as string | undefined) || (chat.team_id as string | undefined);
        if (dynamicEnabled && !chat.assigned_to && finalTeamId) {
          const pick = await pickAgentLeastOpenChats({ organizationId, teamId: finalTeamId });
          if (pick) {
            updateData.assigned_to = pick;
            updateData.assigned_at = new Date().toISOString();
          }
        }
      }

      // Update wa_name if not locked and we have a new name (only for messages from lead)
      if (!chat.name_locked && pushName && !isGroup && !fromMe) {
        updateData.wa_name = pushName;
      }

      // Update profile picture if we fetched a new one
      if (profilePictureUrl) {
        if (isGroup) {
          updateData.group_photo_url = profilePictureUrl;
        } else {
          updateData.wa_photo_url = profilePictureUrl;
        }
      }

      // Update group info if available — only overwrite with REAL data, never with fallbacks
      if (isGroup && groupInfo) {
        // Only update group_name if we got a real subject (not empty/null)
        if (groupInfo.subject) {
          updateData.group_name = groupInfo.subject;
          updateData.wa_name = groupInfo.subject;
        }
        // Only update participant_count if we got a real positive number
        if (typeof groupInfo.size === 'number' && groupInfo.size > 0) {
          updateData.participant_count = groupInfo.size;
        }
      }

      updateDataForChat = updateData;

      // Sync group participants snapshot
      if (isGroup && groupInfo) {
        await syncGroupParticipantsSnapshot(supabase, organizationId, chat.id, groupInfo);
      }
    }

    // Auto-apply "Anúncio" tag if any ad attribution was detected
    if ((adId || sourceUrl || campaignId) && !fromMe) {
      await addAdTag(supabase, chat.id, organizationId);
    }

    // If we still have LID mentions that weren't resolved (no mentionedJid in payload),
    // try to resolve them using database lookup
    if (isGroup && content && /@\d{14,20}/.test(content)) {
      content = await resolveLidMentionsWithFallback(supabase, content, chat.id);
    }
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    // Map internal message type FIRST to check if it's media
    const internalMessageType = mapMessageType(messageType);

    // Avoid DB constraint errors: for unsupported types, store as system with a short label
    if (internalMessageType === 'system' && (content === null || content === undefined || String(content).trim() === '')) {
      content = `[${messageType || 'system'}]`;
    }

    console.log('[evolution-webhook-receiver] [MEDIA] Processing media check');
    console.log('[evolution-webhook-receiver] [MEDIA] Raw message type:', messageType);
    console.log('[evolution-webhook-receiver] [MEDIA] Internal message type:', internalMessageType);
    console.log('[evolution-webhook-receiver] [MEDIA] Is media type:', ['audio', 'image', 'video', 'document', 'pdf'].includes(internalMessageType));
    console.log('[evolution-webhook-receiver] [MEDIA] Has Evolution config:', !!evolutionConfig);

    if (['audio', 'image', 'video', 'document', 'pdf'].includes(internalMessageType) && evolutionConfig) {
      console.log('[evolution-webhook-receiver] [MEDIA] Starting media conversion...');
      let base64Data: { base64: string; fileName?: string } | null = null;

      try {
        // Priority 1: Check if Evolution already sent the base64 natively inside the webhook payload
        const nativeBase64 = data.base64 || data.message?.base64 || data.message?.imageMessage?.base64 || data.message?.videoMessage?.base64 || data.message?.audioMessage?.base64 || data.message?.documentMessage?.base64;
        if (nativeBase64) {
          console.log('[evolution-webhook-receiver] [MEDIA] Utilizando base64 embutido no webhook.');
          base64Data = {
            base64: nativeBase64,
            fileName: data.message?.fileName || "unknown"
          };
        } else {
          // Fallback: If for some reason missing, request it remotely passing the full WA message
          console.log('[evolution-webhook-receiver] [MEDIA] Base64 ausente. Buscando via getBase64FromMediaMessage com WAMessage completa...');
          base64Data = await getBase64FromMedia(evolutionConfig, data, internalMessageType === 'video');

          // Retry once after 2s if initial attempt failed (media may not be ready on WA servers yet)
          if (!base64Data?.base64) {
            console.log('[evolution-webhook-receiver] [MEDIA] First attempt failed, retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
            base64Data = await getBase64FromMedia(evolutionConfig, data, internalMessageType === 'video');
          }
        }

        console.log('[evolution-webhook-receiver] [MEDIA] Base64 result:', base64Data?.base64 ? 'received' : 'null');

        if (!base64Data?.base64) {
          fileName = 'error_no_base64_returned.txt';
          // Set descriptive content so UI shows a meaningful placeholder
          content = content || `[${internalMessageType}] - Mídia indisponível`;
        } else {
          const mimeType = getMimeType(message, internalMessageType);
          let originalFileName = getFileName(message, internalMessageType, base64Data.fileName);
          
          if (internalMessageType === 'audio' && originalFileName.match(/\.(oga|ogg)$/i)) {
              originalFileName = originalFileName.replace(/\.(oga|ogg)$/i, '.mp3');
          }

          let cleanBase64 = base64Data.base64.replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
          const binaryString = atob(cleanBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          fileSize = bytes.length;

          // Upload to storage (R2 primary, Supabase fallback)
          const storagePath = `${chat.id}/${Date.now()}_${originalFileName}`;

          console.log('[evolution-webhook-receiver] [MEDIA] Uploading to storage:', storagePath);

          // Try R2 first
          const r2Url = await uploadToR2(bytes, storagePath, mimeType);

          if (r2Url) {
            fileUrl = r2Url;
            fileName = originalFileName;
            console.log('[evolution-webhook-receiver] [MEDIA] ✅ Uploaded to R2:', fileUrl);
          } else {
            // Fallback to Supabase Storage
            console.log('[evolution-webhook-receiver] [MEDIA] R2 unavailable, falling back to Supabase Storage');
            const { data: uploadResult, error: uploadError } = await supabase.storage
              .from('chat-files')
              .upload(storagePath, bytes, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) {
              console.error('[evolution-webhook-receiver] [MEDIA] Upload error:', uploadError);
              fileName = `upload_error: ${uploadError.message}`;
            } else {
              const { data: publicUrlData } = supabase.storage
                .from('chat-files')
                .getPublicUrl(storagePath);
              fileUrl = publicUrlData.publicUrl;
              fileName = originalFileName;
              console.log('[evolution-webhook-receiver] [MEDIA] ✅ Uploaded to Supabase Storage:', fileUrl);
            }
          }
        }
      } catch (err: any) {
        console.error('[evolution-webhook-receiver] [MEDIA] ❌ Error converting media:', err);
        fileName = 'base64_crash.txt';
        content = `Erro ao processar mídia: ${err.message || String(err)} - Base64 preview: ${base64Data?.base64 ? base64Data.base64.substring(0, 30) : 'none'}`;
      }
    } else {
      console.log('[evolution-webhook-receiver] [MEDIA] Skipping media processing - not a media type or no config');
    }

    // Save message to database
    // fromMe = false means message is from lead (is_from_user = false)
    // fromMe = true means message is from agent/us (is_from_user = true)
    const messageDataToInsert: any = {
      chat_id: chat.id,
      organization_id: organizationId,
      content: content,
      message_type: internalMessageType,
      is_from_user: fromMe, // fromMe = true (agent), fromMe = false (lead)
      external_message_id: messageKeyId,
      sender_name: isGroup ? senderName : null,
      // Persist sender identifiers for group messages (only for incoming participant messages)
      sender_phone: isGroup && !fromMe ? senderPhone : null,
      sender_jid: isGroup && !fromMe ? senderJid : null,
      created_at: new Date().toISOString(),
      sent_from_platform: false, // All messages coming from Evolution are NOT from platform
      is_follow_up: false, // Messages from Evolution are NOT follow-up messages
      // [BUG-3 FIX] Tag all Evolution-originated messages so the ghl-outbound-sync
      // anti-loop guard and future dedup logic can identify origin without ambiguity.
      sync_source: 'evolution',
    };

    // Persist quoted data (incoming replies)
    if (quotedExternalId) {
      messageDataToInsert.quoted_external_message_id = quotedExternalId;

      // Try to resolve local quoted_message_id + enrich preview
      try {
        const { data: quotedMsg } = await supabase
          .from('messages')
          .select('id, content, message_type, file_name')
          .eq('external_message_id', quotedExternalId)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (quotedMsg?.id) {
          messageDataToInsert.quoted_message_id = quotedMsg.id;
        }

        const preview: QuotedPreview = {
          ...(quotedPreviewFromPayload || {}),
        };

        // If payload doesn't include a preview, derive from local message
        if (!preview.text && !preview.label && quotedMsg) {
          preview.message_type = quotedMsg.message_type;
          if (quotedMsg.message_type === 'text' && typeof quotedMsg.content === 'string' && quotedMsg.content.trim()) {
            preview.text = quotedMsg.content;
          } else if (quotedMsg.message_type && quotedMsg.message_type !== 'text') {
            const name = quotedMsg.file_name ? `: ${quotedMsg.file_name}` : '';
            preview.label = `[${quotedMsg.message_type}]${name}`;
          }
        }

        if (preview.text || preview.label || preview.message_type) {
          messageDataToInsert.quoted_preview = preview;
        }
      } catch (e) {
        console.log('[evolution-webhook-receiver] Failed resolving quoted message:', e);
      }
    }

    if (fileUrl) {
      messageDataToInsert.file_url = fileUrl;
      if (fileSize) {
        messageDataToInsert.file_size = fileSize;
      }
    }
    if (fileName) {
      messageDataToInsert.file_name = fileName;
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messageDataToInsert)
      .select()
      .single();

    if (messageError) {
      if (messageError.code === '23505') {
        console.log('[evolution-webhook-receiver] Duplicate message caught by DB unique constraint, ignoring gracefully:', messageKeyId);
        return new Response(
          JSON.stringify({ ignored: true, reason: 'duplicate_constraint' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('[evolution-webhook-receiver] Error saving message:', messageError);
      throw messageError;
    }

    console.log('[evolution-webhook-receiver] Message saved:', savedMessage.id, '| fromMe:', fromMe, '| is_from_user:', fromMe);

    // [HOTFIX] Explicitly trigger GHL sync for ALL non-private messages (including Inbound media)
    // This bypasses the old broken DB trigger that ignored inbound messages.
    if (!savedMessage.private) {
      console.log(`[evolution-webhook-receiver] Triggering GHL sync for message: ${savedMessage.id}`);
      try {
        const ghlPromise = supabase.functions.invoke('ghl-outbound-sync', {
          body: {
            type: 'INSERT',
            table: 'messages',
            schema: 'public',
            record: savedMessage,
          }
        });
        
        // Wait gracefully to ensure Deno doesn't kill the isolate before the request is dispatched
        await ghlPromise;
      } catch (err) {
        console.error('[evolution-webhook-receiver] Non-blocking GHL sync error:', err);
      }
    }

    if (updateDataForChat) {
      await supabase
        .from('chats')
        .update(updateDataForChat)
        .eq('id', chat.id);
    }

    // Check message tag rules for inbound messages (from lead, not from agent)
    if (!fromMe && content && internalMessageType === 'text') {
      try {
        const { data: tagRules } = await supabase
          .from('message_tag_rules')
          .select('id, tag_id, match_text, match_type')
          .eq('organization_id', organizationId)
          .eq('active', true);

        if (tagRules && tagRules.length > 0) {
          const contentLower = content.toLowerCase().trim();
          for (const rule of tagRules) {
            const matchTextLower = rule.match_text.toLowerCase().trim();
            let matched = false;

            if (rule.match_type === 'exact') {
              matched = contentLower === matchTextLower;
            } else if (rule.match_type === 'contains') {
              matched = contentLower.includes(matchTextLower);
            }

            if (matched) {
              console.log(`[evolution-webhook-receiver] Tag rule matched: "${rule.match_text}" (${rule.match_type}) -> tag ${rule.tag_id}`);
              // Check if tag already assigned
              const { data: existingTag } = await supabase
                .from('chat_tags')
                .select('id')
                .eq('chat_id', chat.id)
                .eq('tag_id', rule.tag_id)
                .maybeSingle();

              if (!existingTag) {
                await supabase.from('chat_tags').insert({
                  chat_id: chat.id,
                  tag_id: rule.tag_id,
                  organization_id: organizationId,
                });
                console.log(`[evolution-webhook-receiver] Auto-applied tag ${rule.tag_id} to chat ${chat.id}`);
              }
            }
          }
        }
      } catch (tagRuleError) {
        console.error('[evolution-webhook-receiver] Error checking message tag rules:', tagRuleError);
      }
    }

    // Update group participant data from message (more reliable than groupInfo API)
    if (isGroup && !fromMe && senderJid) {
      await updateGroupParticipantFromMessage({
        supabase,
        organizationId,
        groupChatId: chat.id,
        senderJid,
        senderPhone,
        senderName,
      });
    }

    // Auto messages (welcome/away) are triggered only on inbound lead messages (non-group)
    if (!fromMe && !isGroup) {
      await maybeSendAutoMessages({
        supabase,
        organizationId,
        chat,
        phone,
        evolutionConfig,
        now: new Date(),
      });

      // Resume any automation waiting for response from this chat
      const resumedAutomationIds = new Set<string>();
      try {
        const { data: waitingExecs } = await supabase
          .from('automation_executions')
          .select('id, current_node_id, automation_id, context, created_at')
          .eq('chat_id', chat.id)
          .eq('organization_id', organizationId)
          .in('status', ['waiting_response', 'waiting_ai'])
          .order('created_at', { ascending: false });

        if (waitingExecs && waitingExecs.length > 0) {
          // DEDUP: group by automation_id, only resume the LATEST execution per automation
          const latestByAutomation = new Map<string, any>();
          const staleExecs: string[] = [];

          for (const exec of waitingExecs) {
            if (!latestByAutomation.has(exec.automation_id)) {
              latestByAutomation.set(exec.automation_id, exec);
            } else {
              // This is a stale duplicate — mark it as completed
              staleExecs.push(exec.id);
            }
          }

          // Force-complete stale duplicate executions
          if (staleExecs.length > 0) {
            console.log(`[evolution-webhook-receiver] Completing ${staleExecs.length} stale duplicate executions:`, staleExecs);
            // Also cancel their background jobs
            await supabase.from('automation_background_jobs')
              .update({ status: 'cancelled' })
              .in('execution_id', staleExecs)
              .in('status', ['pending', 'processing']);
            await supabase.from('automation_executions')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .in('id', staleExecs);
          }

          for (const exec of latestByAutomation.values()) {
            // Track resumed automation to prevent re-triggering as message_received
            resumedAutomationIds.add(exec.automation_id);
            // Use context.wait_node_id as fallback when current_node_id is null
            // (happens when flow is saved while execution is waiting - FK SET NULL)
            const effectiveNodeId = exec.current_node_id || exec.context?.wait_node_id;
            if (!effectiveNodeId) {
              console.log('[evolution-webhook-receiver] No valid node ID for execution:', exec.id);
              continue;
            }

            // Get edges from the wait node
            const { data: outEdges } = await supabase
              .from('automation_edges')
              .select('target_node_id, source_handle_id')
              .eq('automation_id', exec.automation_id)
              .eq('source_node_id', effectiveNodeId)
              .eq('organization_id', organizationId);

            // Get the current node to check type
            const { data: currentNode } = await supabase
              .from('automation_nodes')
              .select('node_type, config')
              .eq('id', effectiveNodeId)
              .single();

            let nextNodes: string[] = [];

            if (currentNode?.node_type === 'ask_question') {
              // Match response to option and follow the correct handle
              const options: string[] = currentNode.config?.options || [];
              const responseText = (content || '').trim().toLowerCase();
              const matchIndex = options.findIndex((opt: string, i: number) => {
                const optLower = opt.toLowerCase();
                return responseText === optLower || responseText === String(i + 1);
              });

              if (matchIndex >= 0) {
                const handleId = `opt-${matchIndex}`;
                const matchEdge = (outEdges || []).find((e: any) => e.source_handle_id === handleId);
                if (matchEdge) nextNodes = [matchEdge.target_node_id];
              }
              // If no match, follow first edge as fallback
              if (nextNodes.length === 0 && outEdges?.length) {
                nextNodes = [outEdges[0].target_node_id];
              }
            } else if (currentNode?.node_type === 'condition' && exec.context?.condition_wait) {
              // Response-based condition: evaluate against the lead's response
              const condConfig = currentNode.config || {};
              const responseText = (content || '').trim().toLowerCase();
              const condValue = (condConfig.condition_value || '').trim().toLowerCase();
              let condResult = false;

              if (condConfig.condition_type === 'response_equals') {
                condResult = responseText === condValue;
              } else if (condConfig.condition_type === 'response_contains') {
                condResult = responseText.includes(condValue);
              } else if (condConfig.condition_type === 'response_is_one_of' || condConfig.condition_type === 'response_in') {
                const values = Array.isArray(condConfig.condition_values)
                  ? condConfig.condition_values.map((v: string) => v.trim().toLowerCase())
                  : condValue.split(',').map((v: string) => v.trim());
                condResult = values.includes(responseText);
              }

              const handleId = condResult ? 'yes' : 'no';
              const matchEdge = (outEdges || []).find((e: any) => e.source_handle_id === handleId);
              if (matchEdge) {
                nextNodes = [matchEdge.target_node_id];
              } else if (outEdges?.length) {
                nextNodes = [outEdges[0].target_node_id];
              }
            } else if (currentNode?.node_type === 'ai_agent' && exec.context?.dialogue_mode) {
              // Dialogue mode: resume back to the SAME ai_agent node (loop)
              nextNodes = [effectiveNodeId];
            } else if (currentNode?.node_type === 'ai_agent' && exec.context?.ai_agent_timeout_mode) {
              // Non-dialogue AI agent with timeout: lead responded → follow "completed" handle
              const completedEdge = (outEdges || []).find((e: any) => e.source_handle_id === 'completed');
              if (completedEdge) {
                nextNodes = [completedEdge.target_node_id];
              } else if (outEdges?.length) {
                nextNodes = [outEdges[0].target_node_id];
              }
            } else if (currentNode?.node_type === 'follow_up_ai') {
              const respondedEdge = (outEdges || []).find((e: any) => e.source_handle_id === 'responded');
              if (respondedEdge) {
                nextNodes = [respondedEdge.target_node_id];
              } else if (outEdges?.length) {
                nextNodes = [outEdges[0].target_node_id];
              }
            } else {
              // wait_response node: follow "responded" handle
              const respondedEdge = (outEdges || []).find((e: any) => e.source_handle_id === 'responded');
              if (respondedEdge) {
                nextNodes = [respondedEdge.target_node_id];
              } else if (outEdges?.length) {
                nextNodes = [outEdges[0].target_node_id];
              }
            }

            if (nextNodes.length > 0) {
              // Count a successful response for conversion stats on the waiting node
              if (exec.current_node_id) {
                // Use RPC for unique lead counting
                await supabase.rpc("increment_node_stat_responded", {
                  p_node_id: exec.current_node_id,
                  p_automation_id: exec.automation_id,
                  p_organization_id: organizationId,
                  p_chat_id: chatId,
                });
              }

              // Update context with the response - clean stale dialogue/follow-up context
              const cleanedContext = { ...exec.context, last_response: content, last_response_at: new Date().toISOString() };
              // When resuming from follow_up_ai or non-dialogue ai_agent, clear mode flags
              // so subsequent dialogue AI nodes start fresh
              if (currentNode?.node_type === 'follow_up_ai') {
                delete cleanedContext.follow_up_ai_mode;
                delete cleanedContext.follow_up_last_sent_at;
              }
              if (currentNode?.node_type === 'ai_agent' && exec.context?.ai_agent_timeout_mode) {
                delete cleanedContext.ai_agent_timeout_mode;
              }

              // Phase 3: CRM Auto-Save Integration for Capture Info
              if (exec.context?.capture_field && exec.context?.capture_auto_save !== false && content) {
                try {
                  const fieldKey = exec.context.capture_field;
                  const { data: fieldRef } = await supabase.from('chat_custom_fields')
                    .select('id').eq('field_key', fieldKey).eq('organization_id', organizationId).maybeSingle();

                  if (fieldRef) {
                    await supabase.from('chat_custom_field_values').upsert({
                      chat_id: chat.id,
                      organization_id: organizationId,
                      field_id: fieldRef.id,
                      value: content.trim()
                    }, { onConflict: 'chat_id,field_id' });
                    console.log(`[evolution-webhook-receiver] Auto-saved captured info to CRM for field ${fieldKey}`);
                  }
                } catch (saveErr) {
                  console.error('[evolution-webhook-receiver] Failed to auto-save captured info:', saveErr);
                }
                delete cleanedContext.capture_field;
                delete cleanedContext.capture_auto_save;
              }

              await supabase
                .from('automation_executions')
                .update({
                  status: 'running',
                  resume_at: null,
                  context: cleanedContext,
                })
                .eq('id', exec.id);

              // Resume execution background
              const payload = {
                resume_execution_id: exec.id,
                trigger_type: 'resume',
                chat_id: chat.id,
                organization_id: organizationId,
                start_from_nodes: nextNodes,
              };

              const { data: bgJob } = await supabase.from('automation_background_jobs').insert({
                organization_id: organizationId,
                execution_id: exec.id,
                chat_id: chat.id,
                job_type: 'resume_automation',
                payload
              }).select('id').single();

              if (bgJob) {
                dispatchJob(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, bgJob.id);
                console.log('[evolution-webhook-receiver] Queued automation resume:', exec.id);
              }
            }
          }
        }
      } catch (autoErr) {
        console.error('[evolution-webhook-receiver] Error resuming automation:', autoErr);
      }

      // Trigger message_received automations based on chat's current funnel stages
      try {
        // Get all funnel stages this chat is currently in
        const { data: chatStages } = await supabase
          .from('chat_funnel_stage')
          .select('stage_id, funnel_id')
          .eq('chat_id', chat.id)
          .eq('organization_id', organizationId);

        if (chatStages && chatStages.length > 0) {
          const stageIds = chatStages.map((cs: any) => cs.stage_id);
          const funnelIds = chatStages.map((cs: any) => cs.funnel_id);

          // Find active automations with message_received trigger linked to these stages/funnels
          const { data: msgAutomations } = await supabase
            .from('automations')
            .select('id, trigger_stage_id, funnel_id')
            .eq('organization_id', organizationId)
            .eq('status', 'active')
            .eq('trigger_type', 'message_received')
            .in('funnel_id', funnelIds);

          if (msgAutomations && msgAutomations.length > 0) {
            for (const auto of msgAutomations) {
              // Skip automations that were already resumed from a waiting state
              if (resumedAutomationIds.has(auto.id)) {
                console.log('[evolution-webhook-receiver] Skipping message_received for already-resumed automation:', auto.id);
                continue;
              }
              // If automation has a specific trigger_stage_id, check chat is in that stage
              if (auto.trigger_stage_id && !stageIds.includes(auto.trigger_stage_id)) continue;

              // Fire automation (executor handles deduplication)
              const matchingStage = chatStages.find((cs: any) =>
                cs.funnel_id === auto.funnel_id &&
                (!auto.trigger_stage_id || cs.stage_id === auto.trigger_stage_id)
              );

              const payload = {
                trigger_type: 'message_received',
                chat_id: chat.id,
                stage_id: matchingStage?.stage_id || null,
                funnel_id: auto.funnel_id,
                organization_id: organizationId,
                automation_id: auto.id,
              };

              const { data: bgJob } = await supabase.from('automation_background_jobs').insert({
                organization_id: organizationId,
                chat_id: chat.id,
                job_type: 'trigger_automation',
                payload
              }).select('id').single();

              if (bgJob) {
                dispatchJob(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, bgJob.id);
                console.log('[evolution-webhook-receiver] Queued message_received automation:', auto.id);
              }
            }
          }
        }
      } catch (autoTriggerErr) {
        console.error('[evolution-webhook-receiver] Error triggering message_received automations:', autoTriggerErr);
      }
    }

    // Add "Lead Frio" tag for new chats (only for messages from lead)
    if (isNewChat && !fromMe) {
      await addLeadFrioTag(supabase, chat.id, organizationId);
    }

    // Dispatch webhook for BOTH directions (fromMe true or false)
    // This ensures the AI/n8n receives all messages for memory
    await dispatchReceivedWebhook(supabase, {
      chatId,
      phone,
      isGroup,
      fromMe,
      messageType: internalMessageType,
      content,
      pushName,
      messageKeyId,
      senderPhone,
      senderName,
      groupName: isGroup ? (groupInfo?.subject || chat.group_name) : null,
      evolutionData: data,
    }, organizationId, organization, chat, savedMessage, evolutionConfig, fileUrl, fileName);

    return new Response(
      JSON.stringify({
        success: true,
        chat_id: chat.id,
        message_id: savedMessage.id,
        is_new_chat: isNewChat,
        from_me: fromMe,
        direction: fromMe ? 'outgoing' : 'incoming'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[evolution-webhook-receiver] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
