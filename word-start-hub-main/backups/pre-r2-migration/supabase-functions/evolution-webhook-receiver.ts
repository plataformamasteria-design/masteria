import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionApiConfig {
  url: string;
  apiKey: string;
  instanceName: string;
}

interface MessageData {
  chatId: string;
  phone: string;
  isGroup: boolean;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  pushName: string | null;
  messageKeyId: string;
  senderPhone?: string | null;
  senderName?: string | null;
  groupName?: string | null;
  evolutionData: any;
}

type QuotedPreview = {
  text?: string;
  label?: string;
  message_type?: string;
};

const ALLOWED_INTERNAL_MESSAGE_TYPES = new Set([
  'text',
  'audio',
  'image',
  'pdf',
  'video',
  'document',
  'contact',
  'location',
  'pix',
  'system',
]);

type BusinessHours = {
  days: number[]; // 0=Dom, 1=Seg ... 6=Sáb
  start: string; // HH:mm
  end: string; // HH:mm
  lunch_enabled: boolean;
  lunch_start: string;
  lunch_end: string;
};

type AutoMessagesConfig = {
  welcome_enabled: boolean;
  welcome_message: string | null;
  welcome_inactive_hours: number;
  away_enabled: boolean;
  away_message: string | null;
  business_hours: BusinessHours;
  timezone: string;
};

function parseTimeToMinutes(value: string): number {
  const [h, m] = (value || '00:00').split(':').map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function getZonedParts(date: Date, timeZone: string): { weekday: number; minutes: number } {
  // weekday: 0=Sun..6=Sat
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const wk = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[wk] ?? 0,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

function isWithinBusinessHours(now: Date, cfg: AutoMessagesConfig): boolean {
  const tz = cfg.timezone || 'America/Sao_Paulo';
  const { weekday, minutes } = getZonedParts(now, tz);
  const hours = cfg.business_hours;
  if (!hours?.days?.includes(weekday)) return false;

  const startMin = parseTimeToMinutes(hours.start);
  const endMin = parseTimeToMinutes(hours.end);
  const inMain = minutes >= startMin && minutes < endMin;
  if (!inMain) return false;

  if (hours.lunch_enabled) {
    const lunchStart = parseTimeToMinutes(hours.lunch_start);
    const lunchEnd = parseTimeToMinutes(hours.lunch_end);
    const inLunch = minutes >= lunchStart && minutes < lunchEnd;
    if (inLunch) return false;
  }
  return true;
}

async function sendTextToEvolution(config: EvolutionApiConfig, phone: string, text: string) {
  const url = `${config.url}/message/sendText/${config.instanceName}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({ number: phone, text }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`Evolution sendText failed: ${resp.status} - ${body}`);
  }

  // Try to parse response to extract external id when available
  try {
    const parsed = JSON.parse(body);
    // Different Evolution builds use different shapes; try common paths
    const externalId =
      parsed?.key?.id ??
      parsed?.message?.key?.id ??
      parsed?.data?.key?.id ??
      parsed?.data?.message?.key?.id ??
      parsed?.id ??
      null;
    return { raw: parsed, externalId: externalId ? String(externalId) : null };
  } catch {
    return { raw: body, externalId: null };
  }
}

async function maybeSendAutoMessages(params: {
  supabase: any;
  organizationId: string;
  chat: any;
  phone: string;
  evolutionConfig: EvolutionApiConfig | null;
  now: Date;
}) {
  const { supabase, organizationId, chat, phone, evolutionConfig, now } = params;
  if (!evolutionConfig) return;
  if (!chat?.id) return;
  if (!phone) return;
  if (chat.is_group) return;

  const { data: cfgRow, error } = await supabase
    .from('organization_auto_messages')
    .select('welcome_enabled,welcome_message,welcome_inactive_hours,away_enabled,away_message,business_hours,timezone')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.log('[evolution-webhook-receiver] [AUTO] Failed loading auto message config:', error);
    return;
  }
  if (!cfgRow) return;

  const cfg = cfgRow as AutoMessagesConfig;
  const updates: any = { last_inbound_at: now.toISOString() };

  const lastWelcomeSentAt = chat.last_welcome_sent_at ? new Date(chat.last_welcome_sent_at) : null;
  const lastAwaySentAt = chat.last_away_sent_at ? new Date(chat.last_away_sent_at) : null;

  // Regra: nunca enviar as duas. Decide pelo horário comercial.
  const inBusiness = isWithinBusinessHours(now, cfg);
  console.log('[evolution-webhook-receiver] [AUTO] inBusiness:', inBusiness);

  // Dentro do horário: Boas-vindas (se aplicável)
  if (inBusiness && cfg.welcome_enabled && cfg.welcome_message?.trim()) {
    const inactiveHours = Number(cfg.welcome_inactive_hours || 24);
    const inactiveMs = inactiveHours * 60 * 60 * 1000;
    
    // NEW LOGIC: Check if WE sent any message (outbound) in the last 24 hours
    // This includes messages sent from platform OR from external devices (fromMe=true)
    const cutoffTime = new Date(now.getTime() - inactiveMs).toISOString();
    
    const { data: recentOutboundMessages, error: outboundErr } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_id', chat.id)
      .eq('is_from_user', true) // Our messages (outbound)
      .gte('created_at', cutoffTime)
      .limit(1);
    
    if (outboundErr) {
      console.log('[evolution-webhook-receiver] [AUTO] Error checking outbound messages:', outboundErr);
    }
    
    const hadRecentOutbound = recentOutboundMessages && recentOutboundMessages.length > 0;
    const welcomeCooldownOk = !lastWelcomeSentAt || now.getTime() - lastWelcomeSentAt.getTime() >= inactiveMs;

    // Only send welcome if NO outbound messages in last 24h AND cooldown OK
    if (!hadRecentOutbound && welcomeCooldownOk) {
      try {
        console.log('[evolution-webhook-receiver] [AUTO] Sending welcome message (no outbound in last 24h)');
        const sent = await sendTextToEvolution(evolutionConfig, phone, cfg.welcome_message.trim());

        // Registrar a mensagem no banco para aparecer na plataforma
        const { data: inserted, error: insertErr } = await supabase
          .from('messages')
          .insert({
            chat_id: chat.id,
            organization_id: chat.organization_id,
            content: cfg.welcome_message.trim(),
            message_type: 'text',
            is_from_user: true,
            external_message_id: sent.externalId,
            created_at: now.toISOString(),
            sent_from_platform: true,
            is_follow_up: false,
            private: false,
          })
          .select('id')
          .single();

        if (insertErr) {
          console.log('[evolution-webhook-receiver] [AUTO] Failed inserting welcome message row:', insertErr);
        } else {
          console.log('[evolution-webhook-receiver] [AUTO] Welcome message recorded:', inserted?.id);
        }

        updates.last_welcome_sent_at = now.toISOString();
      } catch (e) {
        console.log('[evolution-webhook-receiver] [AUTO] Welcome send failed:', e);
      }
    } else {
      console.log('[evolution-webhook-receiver] [AUTO] Welcome not sent:', {
        reason: hadRecentOutbound ? 'had_outbound_in_24h' : 'cooldown_not_met',
        inactiveHours,
        hadRecentOutbound,
        lastWelcomeSentAt: lastWelcomeSentAt?.toISOString?.() ?? null,
      });
    }
  } else if (inBusiness) {
    console.log('[evolution-webhook-receiver] [AUTO] Welcome skipped (disabled/empty).');
  }

  // Fora do horário: Ausência (anti-spam 1x/h)
  if (!inBusiness && cfg.away_enabled && cfg.away_message?.trim()) {
    const oneHourMs = 60 * 60 * 1000;
    const awayCooldownOk = !lastAwaySentAt || now.getTime() - lastAwaySentAt.getTime() >= oneHourMs;
    if (awayCooldownOk) {
      try {
        console.log('[evolution-webhook-receiver] [AUTO] Sending away message');
        const sent = await sendTextToEvolution(evolutionConfig, phone, cfg.away_message.trim());

        const { data: inserted, error: insertErr } = await supabase
          .from('messages')
          .insert({
            chat_id: chat.id,
            organization_id: chat.organization_id,
            content: cfg.away_message.trim(),
            message_type: 'text',
            is_from_user: true,
            external_message_id: sent.externalId,
            created_at: now.toISOString(),
            sent_from_platform: true,
            is_follow_up: false,
            private: false,
          })
          .select('id')
          .single();

        if (insertErr) {
          console.log('[evolution-webhook-receiver] [AUTO] Failed inserting away message row:', insertErr);
        } else {
          console.log('[evolution-webhook-receiver] [AUTO] Away message recorded:', inserted?.id);
        }

        updates.last_away_sent_at = now.toISOString();
      } catch (e) {
        console.log('[evolution-webhook-receiver] [AUTO] Away send failed:', e);
      }
    } else {
      console.log('[evolution-webhook-receiver] [AUTO] Away suppressed by 1h anti-spam', {
        lastAwaySentAt: lastAwaySentAt?.toISOString?.() ?? null,
      });
    }
  } else if (!inBusiness) {
    console.log('[evolution-webhook-receiver] [AUTO] Away skipped (disabled/empty).');
  }

  // Persist timestamps (and any send timestamps) in chat
  await supabase.from('chats').update(updates).eq('id', chat.id);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const instanceParam = url.searchParams.get('instance');
    const organizationIdParam = url.searchParams.get('organization_id');

    console.log('[evolution-webhook-receiver] Received webhook');
    console.log('[evolution-webhook-receiver] Instance param:', instanceParam);
    console.log('[evolution-webhook-receiver] Organization ID param:', organizationIdParam);

    // Parse body
    const body = await req.json();
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

    // Only process MESSAGES_UPSERT events for new messages
    if (eventType !== 'MESSAGES.UPSERT' && eventType !== 'MESSAGES_UPSERT') {
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
          console.error('[evolution-webhook-receiver] Could not resolve organization by instance_name or slug:', instanceParam);
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

    // Get Evolution API config
    const evolutionConfig = await getEvolutionConfig(supabase, organization);

    // Fetch or create chat
    const { data: existingChat } = await supabase
      .from('chats')
      .select('*')
      .eq('phone', isGroup ? chatId : phone)
      .eq('organization_id', organizationId)
      .maybeSingle();

    let chat = existingChat;
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
        if (!existingChat || !existingChat.wa_photo_url) {
          profilePictureUrl = await fetchProfilePicture(evolutionConfig, phone);
          console.log('[evolution-webhook-receiver] Fetched profile photo:', profilePictureUrl ? 'success' : 'null');
        }
      }
    }

    if (!chat) {
      // Create new chat
      isNewChat = true;
      const chatData: any = {
        phone: isGroup ? chatId : phone,
        organization_id: organizationId,
        is_group: isGroup,
        wa_name: isGroup ? (groupInfo?.subject || 'Grupo') : pushName,
        wa_photo_url: profilePictureUrl,
        last_message: content?.substring(0, 100) || '',
        last_message_at: new Date().toISOString(),
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
        .single();

      if (chatError) {
        console.error('[evolution-webhook-receiver] Error creating chat:', chatError);
        throw chatError;
      }
      chat = newChat;
      console.log('[evolution-webhook-receiver] Created new chat:', chat.id);

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
      const updateData: any = {
        last_message: content?.substring(0, 100) || (messageType !== 'text' ? `[${messageType}]` : ''),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

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

      // Update group info if available
      if (isGroup && groupInfo) {
        updateData.group_name = groupInfo.subject || chat.group_name;
        updateData.participant_count = groupInfo.size || chat.participant_count;
      }

      await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chat.id);

      // Sync group participants snapshot
      if (isGroup && groupInfo) {
        await syncGroupParticipantsSnapshot(supabase, organizationId, chat.id, groupInfo);
      }
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
      
      try {
        const base64Data = await getBase64FromMedia(evolutionConfig, messageKeyId, internalMessageType === 'video');
        
        console.log('[evolution-webhook-receiver] [MEDIA] Base64 result:', base64Data ? 'received' : 'null');
        
        if (base64Data?.base64) {
          const mimeType = getMimeType(message, internalMessageType);
          const originalFileName = getFileName(message, internalMessageType, base64Data.fileName);
          
          // Decode base64 to bytes
          const binaryString = atob(base64Data.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          fileSize = bytes.length;
          
          // Upload to storage
          const storagePath = `${chat.id}/${Date.now()}_${originalFileName}`;
          
          console.log('[evolution-webhook-receiver] [MEDIA] Uploading to storage:', storagePath);
          
          const { data: uploadResult, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(storagePath, bytes, {
              contentType: mimeType,
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('[evolution-webhook-receiver] [MEDIA] Upload error:', uploadError);
            // Fallback to data URI if storage fails
            fileUrl = `data:${mimeType};base64,${base64Data.base64}`;
            fileName = originalFileName;
          } else {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('chat-files')
              .getPublicUrl(storagePath);
            
            fileUrl = publicUrlData.publicUrl;
            fileName = originalFileName;
            console.log('[evolution-webhook-receiver] [MEDIA] ✅ Uploaded to storage:', fileUrl);
          }
        } else {
          console.error('[evolution-webhook-receiver] [MEDIA] ❌ No base64 data returned from Evolution API');
        }
      } catch (err) {
        console.error('[evolution-webhook-receiver] [MEDIA] ❌ Error converting media:', err);
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
      messageDataToInsert.file_name = fileName;
      if (fileSize) {
        messageDataToInsert.file_size = fileSize;
      }
    }

    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert(messageDataToInsert)
      .select()
      .single();

    if (messageError) {
      console.error('[evolution-webhook-receiver] Error saving message:', messageError);
      throw messageError;
    }

    console.log('[evolution-webhook-receiver] Message saved:', savedMessage.id, '| fromMe:', fromMe, '| is_from_user:', fromMe);

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
          .select('id, current_node_id, automation_id, context')
          .eq('chat_id', chat.id)
          .eq('organization_id', organizationId)
          .eq('status', 'waiting_response');

        if (waitingExecs && waitingExecs.length > 0) {
          for (const exec of waitingExecs) {
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
              await supabase
                .from('automation_executions')
                .update({
                  status: 'running',
                  resume_at: null,
                  context: cleanedContext,
                })
                .eq('id', exec.id);

              // Resume execution
              await supabase.functions.invoke('automation-executor', {
                body: {
                  resume_execution_id: exec.id,
                  trigger_type: 'resume',
                  chat_id: chat.id,
                  organization_id: organizationId,
                  start_from_nodes: nextNodes,
                },
              });
              console.log('[evolution-webhook-receiver] Resumed automation execution:', exec.id);
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

              await supabase.functions.invoke('automation-executor', {
                body: {
                  trigger_type: 'message_received',
                  chat_id: chat.id,
                  stage_id: matchingStage?.stage_id || null,
                  funnel_id: auto.funnel_id,
                  organization_id: organizationId,
                },
              });
              console.log('[evolution-webhook-receiver] Triggered message_received automation:', auto.id);
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
});

// Handle message update (edit) event
async function handleMessageUpdate(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
  console.log('[evolution-webhook-receiver] Processing MESSAGES_UPDATE');
  
  try {
    const data = body.data;

    const candidateExternalIds = uniqStrings([
      data?.key?.id,
      data?.message?.key?.id,
      data?.update?.key?.id,
      data?.protocolMessage?.key?.id,
      data?.message?.protocolMessage?.key?.id,
      data?.message?.protocolMessage?.messageKey?.id,
      data?.message?.protocolMessage?.message?.key?.id,
    ]);

    if (candidateExternalIds.length === 0) {
      console.log('[evolution-webhook-receiver] No candidate external ids for update');
      return new Response(
        JSON.stringify({ ignored: true, reason: 'no_key_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingMessage = await findMessageByExternalIds(
      supabase,
      candidateExternalIds,
      organizationIdParam
    );

    if (!existingMessage) {
      console.log('[evolution-webhook-receiver] Message not found for update. candidateExternalIds:', candidateExternalIds);
      return new Response(
        JSON.stringify({ ignored: true, reason: 'message_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1) Try to interpret this update as delivery/read status (ACK)
    // Different Evolution builds send different shapes. We'll parse defensively.
    const ack =
      data?.ack ??
      data?.messageAck ??
      data?.message_ack ??
      data?.update?.ack ??
      data?.update?.messageAck ??
      data?.receipt?.ack ??
      null;

    const statusTextRaw =
      data?.status ??
      data?.messageStatus ??
      data?.message_status ??
      data?.update?.status ??
      data?.receipt?.status ??
      null;

    const statusText = typeof statusTextRaw === 'string' ? statusTextRaw.toUpperCase() : null;

    const ackNum = typeof ack === 'number' ? ack : (typeof ack === 'string' ? Number(ack) : NaN);
    const isAckNumValid = Number.isFinite(ackNum);

    const isDelivered = (isAckNumValid && ackNum >= 2) || (statusText ? ['DELIVERED', 'DELIVERY_ACK', 'DELIVERED_ACK'].some((s) => statusText.includes(s)) : false);
    const isRead = (isAckNumValid && ackNum >= 3) || (statusText ? ['READ', 'READ_ACK', 'READ_RECEIPT'].some((s) => statusText.includes(s)) : false);

    if (isDelivered || isRead) {
      const nowIso = new Date().toISOString();

      // Delivered implies delivered_at; Read implies read_at (and delivered_at as well).
      if (isDelivered) {
        await supabase
          .from('messages')
          .update({ delivered_at: nowIso })
          .eq('id', existingMessage.id)
          .is('delivered_at', null);
      }

      if (isRead) {
        await supabase
          .from('messages')
          .update({ read_at: nowIso })
          .eq('id', existingMessage.id)
          .is('read_at', null);

        // Ensure delivered_at exists too
        await supabase
          .from('messages')
          .update({ delivered_at: nowIso })
          .eq('id', existingMessage.id)
          .is('delivered_at', null);
      }

      console.log('[evolution-webhook-receiver] ✅ Message status updated:', {
        messageId: existingMessage.id,
        delivered: isDelivered,
        read: isRead,
        ack,
        statusText,
      });

      return new Response(
        JSON.stringify({ success: true, action: 'status_updated', message_id: existingMessage.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Fallback: treat as message edit
    const raw = data?.message || data?.update?.message || data?.editedMessage || {};
    const unwrapped = unwrapMessage(raw);
    const newContent =
      extractTextContent(unwrapped, 'text') ||
      extractTextContent(unwrapped, detectMessageType(unwrapped)) ||
      null;

    // If we can't safely extract the edited text, don't overwrite content.
    if (typeof newContent !== 'string') {
      console.log('[evolution-webhook-receiver] Update received but no newContent extracted; ignoring as edit.', {
        message_id: existingMessage.id,
        candidateExternalIds,
      });
      return new Response(
        JSON.stringify({ ignored: true, reason: 'no_new_content', message_id: existingMessage.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        content: newContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', existingMessage.id);

    if (updateError) {
      console.error('[evolution-webhook-receiver] Error updating message:', updateError);
      throw updateError;
    }

    console.log('[evolution-webhook-receiver] ✅ Message updated:', existingMessage.id);

    return new Response(
      JSON.stringify({ success: true, action: 'updated', message_id: existingMessage.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error in handleMessageUpdate:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update message' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Handle message delete event
async function handleMessageDelete(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
  console.log('[evolution-webhook-receiver] Processing MESSAGES_DELETE');
  
  try {
    const data = body.data;

    const candidateExternalIds = uniqStrings([
      data?.key?.id,
      data?.message?.key?.id,
      data?.update?.key?.id,
      data?.protocolMessage?.key?.id,
      data?.message?.protocolMessage?.key?.id,
      data?.message?.protocolMessage?.messageKey?.id,
      data?.message?.protocolMessage?.message?.key?.id,
    ]);

    if (candidateExternalIds.length === 0) {
      console.log('[evolution-webhook-receiver] No candidate external ids for delete');
      return new Response(
        JSON.stringify({ ignored: true, reason: 'no_key_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingMessage = await findMessageByExternalIds(
      supabase,
      candidateExternalIds,
      organizationIdParam
    );

    if (!existingMessage) {
      console.log('[evolution-webhook-receiver] Message not found for delete. candidateExternalIds:', candidateExternalIds);
      return new Response(
        JSON.stringify({ ignored: true, reason: 'message_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark the message as deleted
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        content: null, // Clear content
      })
      .eq('id', existingMessage.id);

    if (updateError) {
      console.error('[evolution-webhook-receiver] Error deleting message:', updateError);
      throw updateError;
    }

    console.log('[evolution-webhook-receiver] ✅ Message marked as deleted:', existingMessage.id);
    
    return new Response(
      JSON.stringify({ success: true, action: 'deleted', message_id: existingMessage.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error in handleMessageDelete:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete message' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to detect message type
function detectMessageType(message: any): string {
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.audioMessage) return 'audio';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.documentMessage) return 'document';
  if (message.locationMessage) return 'location';
  if (message.contactMessage || message.contactsArrayMessage) return 'contact';
  if (message.stickerMessage) return 'sticker';
  return 'unknown';
}

// Map Evolution message types to internal types
function mapMessageType(evolutionType: string): string {
  const mapping: Record<string, string> = {
    'text': 'text',
    'conversation': 'text',
    'extendedTextMessage': 'text',
    'audioMessage': 'audio',
    'audio': 'audio',
    'imageMessage': 'image',
    'image': 'image',
    'videoMessage': 'video',
    'video': 'video',
    'documentMessage': 'document',
    'document': 'document',
    'pdf': 'pdf',
    'locationMessage': 'location',
    'location': 'location',
    'contactMessage': 'contact',
    'contact': 'contact',
    // Stickers are webp images – map to 'image' so they are downloaded & displayed
    'stickerMessage': 'image',
    'sticker': 'image',
    'reactionMessage': 'system',
    'reactions': 'system',
    'albumMessage': 'system',
    'buttonsMessage': 'system',
    'listMessage': 'system',
    'pollCreationMessage': 'system',
    'pollUpdateMessage': 'system',
  };

  const mapped = mapping[evolutionType] || evolutionType;
  if (ALLOWED_INTERNAL_MESSAGE_TYPES.has(mapped)) return mapped;
  if (ALLOWED_INTERNAL_MESSAGE_TYPES.has(String(mapped).toLowerCase())) return String(mapped).toLowerCase();
  return 'system';
}

// Extract text content from message
function extractTextContent(message: any, messageType: string): string | null {
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.locationMessage) {
    return JSON.stringify({
      latitude: message.locationMessage.degreesLatitude,
      longitude: message.locationMessage.degreesLongitude,
      name: message.locationMessage.name,
      address: message.locationMessage.address,
    });
  }
  if (message.contactMessage?.displayName) {
    return JSON.stringify({
      displayName: message.contactMessage.displayName,
      vcard: message.contactMessage.vcard,
    });
  }
  return null;
}

/**
 * Extract mentionedJid array from message payload (contextInfo)
 * WhatsApp sends mentions in extendedTextMessage.contextInfo.mentionedJid
 * The array contains JIDs like "5588xxx@s.whatsapp.net" that correspond to LID mentions in text
 */
function extractMentionedJidsFromPayload(message: any, rawMessage: any, data: any): string[] {
  // Try multiple paths where mentionedJid might be located - expanded list
  const sources = [
    message?.extendedTextMessage?.contextInfo?.mentionedJid,
    message?.contextInfo?.mentionedJid,
    rawMessage?.extendedTextMessage?.contextInfo?.mentionedJid,
    rawMessage?.contextInfo?.mentionedJid,
    data?.message?.extendedTextMessage?.contextInfo?.mentionedJid,
    data?.contextInfo?.mentionedJid,
    // Additional paths for different Evolution/Baileys versions
    data?.data?.message?.extendedTextMessage?.contextInfo?.mentionedJid,
    rawMessage?.message?.extendedTextMessage?.contextInfo?.mentionedJid,
    data?.data?.contextInfo?.mentionedJid,
    message?.conversation?.contextInfo?.mentionedJid,
    rawMessage?.conversation?.contextInfo?.mentionedJid,
  ];
  
  // Log for debug when there are mentions in text
  const textContent = 
    message?.extendedTextMessage?.text ||
    message?.conversation ||
    rawMessage?.extendedTextMessage?.text ||
    rawMessage?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    '';
  const hasMentionInText = textContent && /@\d{8,20}/.test(textContent);
  
  for (const source of sources) {
    if (Array.isArray(source) && source.length > 0) {
      console.log('[evolution-webhook-receiver] [MENTIONS] Found mentionedJid:', source);
      return source.map((jid: any) => String(jid));
    }
  }
  
  if (hasMentionInText) {
    console.log('[evolution-webhook-receiver] [MENTIONS] Text has mentions but no mentionedJid found. Payload keys:', JSON.stringify({
      messageKeys: Object.keys(message || {}),
      rawMessageKeys: Object.keys(rawMessage || {}),
      dataKeys: Object.keys(data || {}),
    }));
  }
  
  return [];
}

/**
 * Check if a string looks like a LID (Linked ID - anonymous WhatsApp identifier)
 * LIDs are typically 14+ digit numbers (longer than phone numbers)
 */
function isLidToken(token: string): boolean {
  if (!token) return false;
  const digits = token.replace(/\D/g, '');
  // LIDs are typically 14+ digits, phone numbers are 10-13
  return digits.length >= 14;
}

/**
 * Replace LID mentions in text with real phone numbers from mentionedJid array
 * 
 * When WhatsApp sends a message with mentions, it may use LIDs in the text like @123456789012345
 * but provides the real JIDs in contextInfo.mentionedJid array.
 * 
 * This function matches LIDs in text with real JIDs and replaces them with phone numbers.
 */
function resolveLidMentionsInText(text: string, mentionedJids: string[]): string {
  if (!text || mentionedJids.length === 0) return text;
  
  // Extract real phone numbers from JIDs (format: "5588xxx@s.whatsapp.net" or LID format)
  const realPhones = mentionedJids
    .map(jid => {
      const match = String(jid).match(/^(\d+)@/);
      return match ? match[1] : null;
    })
    .filter((phone): phone is string => phone !== null && phone.length <= 15); // Extended to 15 for some edge cases
  
  if (realPhones.length === 0) {
    console.log('[evolution-webhook-receiver] [MENTIONS] No valid phones extracted from mentionedJids');
    return text;
  }
  
  console.log('[evolution-webhook-receiver] [MENTIONS] Real phones from mentionedJids:', realPhones);
  
  // Find all LID-like mentions in text (format: @123456789012345) - extended range 12-20 digits
  const lidPattern = /@(\d{12,20})/g;
  let result = text;
  let match: RegExpExecArray | null;
  const replacements: Array<{ lid: string; phone: string }> = [];
  
  // Collect all LID mentions
  lidPattern.lastIndex = 0;
  while ((match = lidPattern.exec(text)) !== null) {
    const lidToken = match[1];
    // Only treat as LID if it's longer than a typical phone (14+ digits)
    if (lidToken.length >= 14) {
      // Assign real phones to LIDs in order they appear
      const phoneIndex = replacements.length;
      if (phoneIndex < realPhones.length) {
        replacements.push({ lid: lidToken, phone: realPhones[phoneIndex] });
      }
    }
  }
  
  // Apply replacements
  for (const { lid, phone } of replacements) {
    result = result.replace(new RegExp(`@${lid}\\b`, 'g'), `@${phone}`);
    console.log('[evolution-webhook-receiver] [MENTIONS] Replaced LID', lid, 'with phone', phone);
  }
  
  return result;
}

/**
 * Fallback: Resolve LID mentions using database lookup when mentionedJid is missing from payload
 */
async function resolveLidMentionsWithFallback(
  supabase: any,
  text: string,
  groupChatId: string
): Promise<string> {
  if (!text) return text;
  
  // Check if there are LID-like mentions in text
  const lidPattern = /@(\d{14,20})/g;
  lidPattern.lastIndex = 0;
  if (!lidPattern.test(text)) {
    return text; // No LIDs in text
  }
  
  console.log('[evolution-webhook-receiver] [MENTIONS] Attempting fallback LID resolution for chat:', groupChatId);
  
  // Fetch participants with real phone numbers for this group
  const { data: participants, error } = await supabase
    .from('group_participants')
    .select('participant_jid, participant_phone')
    .eq('group_chat_id', groupChatId)
    .not('participant_phone', 'is', null)
    .not('participant_phone', 'eq', '');
  
  if (error || !participants?.length) {
    console.log('[evolution-webhook-receiver] [MENTIONS] Fallback: No participants found');
    return text;
  }
  
  // Create map of JID token -> phone
  const jidToPhone = new Map<string, string>();
  for (const p of participants) {
    const token = String(p.participant_jid || '').split('@')[0];
    if (token && p.participant_phone) {
      jidToPhone.set(token, p.participant_phone);
    }
  }
  
  // Replace LIDs that we know
  let result = text;
  lidPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = lidPattern.exec(text)) !== null) {
    const lid = match[1];
    const phone = jidToPhone.get(lid);
    if (phone) {
      result = result.replace(`@${lid}`, `@${phone}`);
      console.log('[evolution-webhook-receiver] [MENTIONS] Fallback resolved LID', lid, 'to phone', phone);
    }
  }
  
  return result;
}

function unwrapMessage(message: any): any {
  // Evolution/Baileys can wrap messages under ephemeral/viewOnce/etc.
  // We'll unwrap the most common wrappers in a loop.
  let current = message;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== 'object') break;

    const next =
      current?.ephemeralMessage?.message ||
      current?.viewOnceMessage?.message ||
      current?.viewOnceMessageV2?.message ||
      current?.viewOnceMessageV2Extension?.message ||
      current?.documentWithCaptionMessage?.message ||
      current?.editedMessage ||
      null;

    if (!next) break;
    current = next;
  }
  return current || message;
}

async function tryHandleProtocolMessage(
  supabase: any,
  protocolMessage: any,
  organizationId: string
): Promise<{ action: 'edited' | 'deleted'; message_id: string } | null> {
  try {
    const typeRaw = protocolMessage?.type ?? protocolMessage?.protocolType ?? protocolMessage?.messageType ?? null;
    const typeStr = typeof typeRaw === 'string' ? typeRaw.toUpperCase() : null;
    const typeNum = typeof typeRaw === 'number' ? typeRaw : (typeof typeRaw === 'string' ? Number(typeRaw) : NaN);

    const key = protocolMessage?.key ?? protocolMessage?.messageKey ?? protocolMessage?.message?.key ?? null;
    const targetExternalId = key?.id ? String(key.id) : null;
    if (!targetExternalId) return null;

    // WhatsApp protocolMessage types (Baileys): 14 = MESSAGE_EDIT.
    const isEdit =
      !!protocolMessage?.editedMessage ||
      typeStr === 'MESSAGE_EDIT' ||
      typeStr === 'EDIT' ||
      typeNum === 14;

    // Revoke types vary by build; attempt to match common variants.
    const isRevoke =
      typeStr === 'REVOKE' ||
      typeStr === 'MESSAGE_REVOKE' ||
      typeStr === 'REVOKED' ||
      typeNum === 0;

    if (!isEdit && !isRevoke) return null;

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('external_message_id', targetExternalId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!existingMessage?.id) {
      console.log('[evolution-webhook-receiver] Protocol target not found:', targetExternalId);
      return null;
    }

    if (isRevoke) {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString(), content: null })
        .eq('id', existingMessage.id);

      console.log('[evolution-webhook-receiver] ✅ Protocol delete applied:', existingMessage.id);
      return { action: 'deleted', message_id: existingMessage.id };
    }

    // Edit
    const edited = unwrapMessage(protocolMessage?.editedMessage || protocolMessage?.message || {});
    const editedText =
      extractTextContent(edited, 'text') ||
      extractTextContent(edited, detectMessageType(edited)) ||
      null;

    await supabase
      .from('messages')
      .update({ content: editedText, edited_at: new Date().toISOString() })
      .eq('id', existingMessage.id);

    console.log('[evolution-webhook-receiver] ✅ Protocol edit applied:', existingMessage.id);
    return { action: 'edited', message_id: existingMessage.id };
  } catch (e) {
    console.error('[evolution-webhook-receiver] Error handling protocolMessage:', e);
    return null;
  }
}

function extractQuotedExternalMessageId(message: any): string | null {
  const m = unwrapMessage(message);

  // Direct candidates (common payloads)
  const directCandidates = [
    m?.messageContextInfo?.stanzaId,
    m?.messageContextInfo?.quotedStanzaId,
    m?.messageContextInfo?.quotedMessageId,
    m?.messageContextInfo?.quotedId,
  ];

  const stanzaIdDirect = directCandidates.find((v) => typeof v === 'string' && v.trim());
  if (stanzaIdDirect) return String(stanzaIdDirect);

  // Scan shallow object tree for contextInfo/messageContextInfo
  const found = findFirstQuotedIdInMessage(m);
  return found;
}

function uniqStrings(arr: any[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const s = String(v).trim();
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function findFirstQuotedIdInMessage(root: any): string | null {
  // bounded scan to avoid huge traversals
  const queue: any[] = [root];
  const visited = new Set<any>();
  let depth = 0;

  while (queue.length && depth < 4) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (visited.has(node)) continue;
      visited.add(node);

      const ctx = (node as any)?.contextInfo || (node as any)?.messageContextInfo || null;
      if (ctx) {
        const candidates = [
          ctx?.stanzaId,
          ctx?.quotedStanzaId,
          ctx?.quotedMessageId,
          ctx?.quotedId,
        ];
        const stanzaId = candidates.find((v) => typeof v === 'string' && v.trim());
        if (stanzaId) return String(stanzaId);
      }

      for (const k of Object.keys(node)) {
        const v = (node as any)[k];
        if (!v) continue;
        if (typeof v === 'object') queue.push(v);
      }
    }
    depth++;
  }

  return null;
}

async function findMessageByExternalIds(
  supabase: any,
  externalIds: string[],
  organizationId: string | null
): Promise<{ id: string; organization_id?: string } | null> {
  try {
    if (!externalIds.length) return null;
    let q = supabase
      .from('messages')
      .select('id, organization_id')
      .in('external_message_id', externalIds)
      .limit(1);
    if (organizationId) q = q.eq('organization_id', organizationId);
    const { data } = await q.maybeSingle();
    return data?.id ? data : null;
  } catch (e) {
    console.error('[evolution-webhook-receiver] Error finding message by external ids:', e);
    return null;
  }
}

function extractQuotedPreviewFromPayload(message: any): QuotedPreview | null {
  const m = unwrapMessage(message);
  const contextInfo =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.audioMessage?.contextInfo ||
    m?.stickerMessage?.contextInfo ||
    m?.messageContextInfo ||
    null;

  const quotedMessage = contextInfo?.quotedMessage || null;
  if (!quotedMessage) return null;

  // Try common shapes
  const text =
    quotedMessage?.conversation ||
    quotedMessage?.extendedTextMessage?.text ||
    quotedMessage?.imageMessage?.caption ||
    quotedMessage?.videoMessage?.caption ||
    quotedMessage?.documentMessage?.caption ||
    null;

  if (typeof text === 'string' && text.trim()) {
    return { text };
  }

  // Non-text quoted: return a generic label
  const type = detectMessageType(quotedMessage);
  if (type && type !== 'unknown') {
    return { label: `[${type}]`, message_type: type };
  }

  return { label: 'Mensagem citada' };
}

// Get MIME type for media
function getMimeType(message: any, messageType: string): string {
  if (message.stickerMessage?.mimetype) return message.stickerMessage.mimetype;
  if (message.audioMessage?.mimetype) return message.audioMessage.mimetype;
  if (message.imageMessage?.mimetype) return message.imageMessage.mimetype;
  if (message.videoMessage?.mimetype) return message.videoMessage.mimetype;
  if (message.documentMessage?.mimetype) return message.documentMessage.mimetype;
  
  // Defaults
  const defaults: Record<string, string> = {
    'audio': 'audio/ogg',
    'image': 'image/jpeg',
    'video': 'video/mp4',
    'document': 'application/pdf',
    'pdf': 'application/pdf',
  };
  return defaults[messageType] || 'application/octet-stream';
}

// Get file name for media
function getFileName(message: any, messageType: string, fallbackName?: string): string {
  if (message.documentMessage?.fileName) return message.documentMessage.fileName;
  if (fallbackName) return fallbackName;
  
  // Generate filename
  const extensions: Record<string, string> = {
    'audio': 'ogg',
    'image': 'jpg',
    'video': 'mp4',
    'document': 'pdf',
    'pdf': 'pdf',
  };
  const ext = extensions[messageType] || 'bin';
  return `${messageType}_${Date.now()}.${ext}`;
}

// Get Evolution API configuration
async function getEvolutionConfig(supabase: any, org: any): Promise<EvolutionApiConfig | null> {
  const { data: globalConfig } = await supabase
    .from('global_config')
    .select('key, value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);

  const globalEvolutionUrl = globalConfig?.find((c: any) => c.key === 'evolution_api_url')?.value;
  const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value;

  // Helper function to validate if a value looks like an API key (not a URL)
  const isValidApiKey = (value: string | null): boolean => {
    if (!value) return false;
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

  if (!evolutionUrl || !evolutionKey) {
    console.log('[evolution-webhook-receiver] Evolution API not configured');
    return null;
  }

  // Clean the URL
  let cleanUrl = evolutionUrl.replace(/\/$/, '');
  cleanUrl = cleanUrl.replace(/\/manager\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/api\/?$/, '');

  const instanceName = org.instance_name || org.slug;

  return {
    url: cleanUrl,
    apiKey: evolutionKey,
    instanceName,
  };
}

// Fetch profile picture from Evolution API
async function fetchProfilePicture(config: EvolutionApiConfig, phone: string): Promise<string | null> {
  try {
    console.log('[evolution-webhook-receiver] [PROFILE] Fetching profile picture for:', phone);
    const response = await fetch(`${config.url}/chat/fetchProfilePictureUrl/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({ number: phone }),
    });

    console.log('[evolution-webhook-receiver] [PROFILE] Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[evolution-webhook-receiver] [PROFILE] Got picture URL:', data.profilePictureUrl ? 'yes' : 'no');
      return data.profilePictureUrl || null;
    } else {
      const errorText = await response.text();
      console.error('[evolution-webhook-receiver] [PROFILE] Error response:', errorText);
    }
  } catch (err) {
    console.error('[evolution-webhook-receiver] [PROFILE] Error fetching profile picture:', err);
  }
  return null;
}

// Fetch group info from Evolution API
async function fetchGroupInfo(config: EvolutionApiConfig, groupJid: string): Promise<any> {
  try {
    const response = await fetch(`${config.url}/group/findGroupInfos/${config.instanceName}?groupJid=${groupJid}`, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error fetching group info:', err);
  }
  return null;
}

function normalizeDigits(input: string): string {
  return String(input || '').split('@')[0].replace(/\D/g, '');
}

// Helper to check if a JID is a LID (Linked ID) format
function isLidFormat(jid: string | null): boolean {
  if (!jid) return false;
  return jid.endsWith('@lid') || jid.includes('@lid');
}

// Check if a phone string looks like a valid real phone (not LID garbage)
function looksLikeRealPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  // Real BR phone: 10-13 digits (with or without country code)
  // LIDs tend to be 14+ digits or don't start with common country codes
  if (digits.length < 8 || digits.length > 15) return false;
  // Rough heuristic: if it starts with common country codes or is short enough
  return true;
}

// Helper to resolve the real phone number from groupInfo participants
// When WhatsApp sends a LID, we try to use participantAlt, p.phone, or match by pushName
function resolveRealPhoneFromGroupInfo(params: {
  senderJid: string | null;
  senderName: string | null;
  groupInfo: any;
}): { phone: string | null; name: string | null } {
  const { senderJid, senderName, groupInfo } = params;
  
  if (!groupInfo) return { phone: null, name: senderName };
  
  const participantsRaw = Array.isArray(groupInfo?.participants)
    ? groupInfo.participants
    : Array.isArray(groupInfo?.data?.participants)
      ? groupInfo.data.participants
      : [];
  
  if (!participantsRaw.length) return { phone: null, name: senderName };
  
  // First, try to find participant by JID/LID match
  const matchedByJid = participantsRaw.find((p: any) => {
    const pJid = String(p?.id || p?.jid || p?.participant || p?.remoteJid || '');
    const pLid = String(p?.lid || '');
    return pJid === senderJid || pLid === senderJid;
  });
  
  if (matchedByJid) {
    // PRIORITY 1: participantAlt (most reliable - contains real phone like "558892161399@s.whatsapp.net")
    const participantAlt = matchedByJid?.participantAlt || '';
    if (participantAlt && String(participantAlt).includes('@s.whatsapp.net')) {
      const altPhone = String(participantAlt).split('@')[0].replace(/\D/g, '');
      if (looksLikeRealPhone(altPhone)) {
        console.log('[evolution-webhook-receiver] [LID-RESOLVE] Found via participantAlt:', senderJid, '-> phone:', altPhone);
        return { phone: altPhone, name: matchedByJid?.notify || matchedByJid?.name || matchedByJid?.pushName || senderName };
      }
    }
    
    // PRIORITY 2: p.phone/p.number (Evolution API sometimes provides real phone here)
    const realPhone = matchedByJid?.phone || matchedByJid?.number;
    if (realPhone && looksLikeRealPhone(realPhone)) {
      const phone = normalizeDigits(realPhone);
      console.log('[evolution-webhook-receiver] [LID-RESOLVE] Found via p.phone/p.number:', senderJid, '-> phone:', phone);
      return { phone, name: matchedByJid?.notify || matchedByJid?.name || matchedByJid?.pushName || senderName };
    }
    
    // PRIORITY 3: if JID is not LID, extract phone from it
    const jid = String(matchedByJid?.id || matchedByJid?.jid || '');
    if (!isLidFormat(jid)) {
      const phone = normalizeDigits(jid);
      if (looksLikeRealPhone(phone)) {
        console.log('[evolution-webhook-receiver] [LID-RESOLVE] Extracted from non-LID jid:', jid, '-> phone:', phone);
        return { phone, name: matchedByJid?.notify || matchedByJid?.name || matchedByJid?.pushName || senderName };
      }
    }
  }
  
  // If senderJid is not a LID, extract phone directly
  if (!isLidFormat(senderJid)) {
    const phone = normalizeDigits(senderJid || '');
    if (looksLikeRealPhone(phone)) {
      const matched = participantsRaw.find((p: any) => {
        const pJid = String(p?.id || p?.jid || p?.participant || p?.remoteJid || '');
        return pJid === senderJid || normalizeDigits(pJid) === phone;
      });
      const displayName = matched?.notify || matched?.name || matched?.pushName || senderName;
      return { phone, name: displayName || senderName };
    }
  }
  
  // It's a LID without participantAlt/p.phone - try to match by pushName
  if (senderName) {
    const matchedByName = participantsRaw.find((p: any) => {
      const pName = p?.notify || p?.name || p?.pushName || '';
      return pName && pName.toLowerCase() === senderName.toLowerCase();
    });
    
    if (matchedByName) {
      // Try participantAlt first
      const participantAlt = matchedByName?.participantAlt || '';
      if (participantAlt && String(participantAlt).includes('@s.whatsapp.net')) {
        const altPhone = String(participantAlt).split('@')[0].replace(/\D/g, '');
        if (looksLikeRealPhone(altPhone)) {
          console.log('[evolution-webhook-receiver] [LID-RESOLVE] Matched by name + participantAlt:', senderName, '-> phone:', altPhone);
          return { phone: altPhone, name: senderName };
        }
      }
      
      // Try p.phone/p.number
      const realPhone = matchedByName?.phone || matchedByName?.number;
      if (realPhone && looksLikeRealPhone(realPhone)) {
        const phone = normalizeDigits(realPhone);
        console.log('[evolution-webhook-receiver] [LID-RESOLVE] Matched by name + p.phone:', senderName, '-> phone:', phone);
        return { phone, name: senderName };
      }
      
      // Fallback to JID if not LID
      const jid = String(matchedByName?.id || matchedByName?.jid || matchedByName?.participant || matchedByName?.remoteJid || '');
      if (!isLidFormat(jid)) {
        const phone = normalizeDigits(jid);
        if (looksLikeRealPhone(phone)) {
          console.log('[evolution-webhook-receiver] [LID-RESOLVE] Matched by name:', senderName, '-> phone:', phone);
          return { phone, name: senderName };
        }
      }
    }
  }
  
  console.log('[evolution-webhook-receiver] [LID-RESOLVE] Could not resolve LID:', senderJid, 'using senderName:', senderName);
  return { phone: null, name: senderName };
}

// Update group participant from message data (more reliable than groupInfo API)
// This function now also searches by phone to find existing LID records and update them
async function updateGroupParticipantFromMessage(params: {
  supabase: any;
  organizationId: string;
  groupChatId: string;
  senderJid: string;
  senderPhone: string | null;
  senderName: string | null;
}) {
  const { supabase, organizationId, groupChatId, senderJid, senderPhone, senderName } = params;
  
  if (!senderJid || !groupChatId) return;
  
  try {
    // Only update if we have useful data (phone or name)
    if (!senderPhone && !senderName) return;
    
    // Try to find existing participant by JID first
    let existing: any = null;
    const { data: byJid } = await supabase
      .from('group_participants')
      .select('id, participant_jid, participant_phone, display_name')
      .eq('group_chat_id', groupChatId)
      .eq('participant_jid', senderJid)
      .maybeSingle();
    
    existing = byJid;
    
    // If not found by JID, try to find by phone (might be stored with LID)
    if (!existing && senderPhone) {
      const { data: byPhone } = await supabase
        .from('group_participants')
        .select('id, participant_jid, participant_phone, display_name')
        .eq('group_chat_id', groupChatId)
        .eq('participant_phone', senderPhone)
        .maybeSingle();
      existing = byPhone;
      if (byPhone) {
        console.log('[evolution-webhook-receiver] [PARTICIPANT] Found existing participant by phone:', senderPhone, '-> existing JID:', byPhone.participant_jid);
      }
    }
    
    if (existing) {
      // Update existing record with better data
      const updates: any = { updated_at: new Date().toISOString() };
      
      // ALWAYS update to the real JID if we have @s.whatsapp.net and current is LID
      if (senderJid.includes('@s.whatsapp.net') && !existing.participant_jid.includes('@s.whatsapp.net')) {
        updates.participant_jid = senderJid;
        console.log('[evolution-webhook-receiver] [PARTICIPANT] Upgrading JID from LID to real:', existing.participant_jid, '->', senderJid);
      }
      
      // Update phone if we have a new one and current is empty
      if (senderPhone && (!existing.participant_phone || existing.participant_phone === '')) {
        updates.participant_phone = senderPhone;
      }
      
      // Update name if we have a new one and current is empty
      if (senderName && !existing.display_name) {
        updates.display_name = senderName;
      }
      
      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { error: updateErr } = await supabase
          .from('group_participants')
          .update(updates)
          .eq('id', existing.id);
        if (updateErr) {
          console.log('[evolution-webhook-receiver] [PARTICIPANT] Update error:', updateErr);
        } else {
          console.log('[evolution-webhook-receiver] [PARTICIPANT] Updated participant from message:', senderJid, 'updates:', JSON.stringify(updates));
        }
      }
    } else {
      // Insert new participant
      const { error: insertErr } = await supabase
        .from('group_participants')
        .insert({
          organization_id: organizationId,
          group_chat_id: groupChatId,
          participant_jid: senderJid,
          participant_phone: senderPhone || '',
          display_name: senderName,
          is_admin: false,
        });
      if (insertErr) {
        console.log('[evolution-webhook-receiver] [PARTICIPANT] Insert error:', insertErr);
      } else {
        console.log('[evolution-webhook-receiver] [PARTICIPANT] Created participant from message:', senderJid, 'phone:', senderPhone, 'name:', senderName);
      }
    }
  } catch (e) {
    console.log('[evolution-webhook-receiver] [PARTICIPANT] Update failed:', e);
  }
}

async function syncGroupParticipantsSnapshot(supabase: any, organizationId: string, groupChatId: string, groupInfo: any) {
  try {
    const participantsRaw = Array.isArray(groupInfo?.participants)
      ? groupInfo.participants
      : Array.isArray(groupInfo?.data?.participants)
        ? groupInfo.data.participants
        : [];

    // Fetch existing participants to preserve their data if new data is empty
    const { data: existingParticipants } = await supabase
      .from('group_participants')
      .select('participant_jid, participant_phone, display_name')
      .eq('group_chat_id', groupChatId);

    const existingMap = new Map<string, { participant_jid: string; participant_phone: string | null; display_name: string | null }>((existingParticipants || []).map((p: any) => [p.participant_jid, p]));

    const normalized = (participantsRaw || [])
      .map((p: any) => {
        // Evolution API sends participant data with:
        // - id/jid/participant: may be LID like "20373232736656@lid" 
        // - participantAlt: real phone like "558892161399@s.whatsapp.net"
        // - phone/number: sometimes provided as backup
        // PRIORITY: participantAlt > phone/number > jid (if not LID)
        
        const rawJid = String(p?.id || p?.jid || p?.participant || p?.remoteJid || '').trim();
        if (!rawJid) return null;
        
        // participantAlt contains the real phone in format "558892161399@s.whatsapp.net"
        const participantAltRaw = p?.participantAlt || '';
        
        // Determine participant_jid - prefer participantAlt if it's a real @s.whatsapp.net JID
        let participantJid = rawJid;
        if (participantAltRaw && String(participantAltRaw).includes('@s.whatsapp.net')) {
          participantJid = String(participantAltRaw).trim();
        }
        
        // Determine real phone number (PRIORITY ORDER):
        // 1. participantAlt (e.g., "558892161399@s.whatsapp.net")
        // 2. p.phone or p.number (Evolution API sometimes provides real phone here)
        // 3. JID itself if it's NOT a LID
        let participantPhone: string | null = null;
        
        // Try participantAlt first (most reliable source for real phone)
        if (participantAltRaw && String(participantAltRaw).includes('@s.whatsapp.net')) {
          const altPhone = String(participantAltRaw).split('@')[0].replace(/\D/g, '');
          if (looksLikeRealPhone(altPhone)) {
            participantPhone = altPhone;
          }
        }
        
        // Fallback to p.phone/p.number
        if (!participantPhone) {
          const rawPhone = p?.phone || p?.number;
          if (rawPhone && looksLikeRealPhone(rawPhone)) {
            participantPhone = normalizeDigits(rawPhone);
          }
        }
        
        // Last resort: extract from JID if it's NOT a LID
        if (!participantPhone && !isLidFormat(rawJid)) {
          const extracted = normalizeDigits(rawJid);
          if (looksLikeRealPhone(extracted)) {
            participantPhone = extracted;
          }
        }
        
        // Log when we can't resolve phone (LID without participantAlt)
        if (!participantPhone && isLidFormat(rawJid)) {
          console.log('[evolution-webhook-receiver] [SYNC] LID without real phone:', rawJid, 'participantAlt:', participantAltRaw || 'none');
        }
        
        const isAdmin = Boolean(p?.admin || p?.isAdmin || p?.is_admin || p?.superAdmin || p?.super_admin);
        const displayName = p?.notify || p?.name || p?.pushName || null;
        
        // Preserve existing data if new data is empty
        const existing = existingMap.get(participantJid);
        
        return {
          organization_id: organizationId,
          group_chat_id: groupChatId,
          participant_jid: participantJid,
          participant_phone: participantPhone || existing?.participant_phone || '',
          display_name: displayName ? String(displayName) : existing?.display_name || null,
          is_admin: isAdmin,
        };
      })
      .filter(Boolean) as any[];

    // Count how many participants with real data we already have
    const participantsWithData = (existingParticipants || []).filter((p: any) => 
      (p.participant_phone && p.participant_phone !== '') || p.display_name
    ).length;
    const apiParticipantCount = participantsRaw.length;

    // Filter out empty LIDs if we already have enough participants with data
    // This prevents creating "ghost" participants when we already have the real ones
    const toUpsert = normalized.filter((p: any) => {
      const isEmptyLid = isLidFormat(p.participant_jid) && !p.participant_phone && !p.display_name;
      if (isEmptyLid && participantsWithData >= apiParticipantCount) {
        console.log('[evolution-webhook-receiver] [SYNC] Skipping empty LID (have enough data):', p.participant_jid);
        return false;
      }
      return true;
    });

    if (toUpsert.length) {
      console.log('[evolution-webhook-receiver] [SYNC] Upserting', toUpsert.length, 'participants (filtered from', normalized.length, ')');
      const { error: upErr } = await supabase
        .from('group_participants')
        .upsert(toUpsert, { onConflict: 'group_chat_id,participant_jid' });
      if (upErr) console.log('[evolution-webhook-receiver] group_participants upsert failed:', upErr);
    }

    // Cleanup removed participants - but PRESERVE those with valuable data (phone or display_name)
    // This prevents deleting participants we enriched from messages when the API only returns LIDs
    const keep = new Set((toUpsert || []).map((r: any) => String(r.participant_jid)));
    const { data: existingAll } = await supabase
      .from('group_participants')
      .select('participant_jid, participant_phone, display_name')
      .eq('group_chat_id', groupChatId)
      .limit(2000);
    
    // Count how many real JID participants with data we have
    const realJidCount = (existingAll || []).filter((r: any) => 
      String(r.participant_jid).includes('@s.whatsapp.net') && 
      ((r.participant_phone && r.participant_phone !== '') || r.display_name)
    ).length;

    // Only delete participants that:
    // 1. Are NOT in the groupInfo list (keep set)
    // 2. AND don't have valuable data (phone or display_name)
    const toDelete = (existingAll || [])
      .filter((r: any) => {
        const jid = String(r.participant_jid);
        const hasValuableData = (r.participant_phone && r.participant_phone !== '') || r.display_name;
        // Keep if in sync list OR has valuable data
        if (!jid) return false;
        if (keep.has(jid)) return false; // In sync list, keep
        if (hasValuableData) {
          console.log('[evolution-webhook-receiver] [SYNC] Preserving participant with valuable data:', jid, 'phone:', r.participant_phone, 'name:', r.display_name);
          return false; // Has valuable data, keep
        }
        return true; // Not in sync list AND no valuable data, delete
      })
      .map((r: any) => String(r.participant_jid));
    
    if (toDelete.length) {
      console.log('[evolution-webhook-receiver] [SYNC] Cleaning up', toDelete.length, 'participants without valuable data');
      await supabase
        .from('group_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .in('participant_jid', toDelete);
    }

    // AGGRESSIVE CLEANUP: Delete empty LIDs when we have enough real JID participants
    // This handles the case where LIDs were created before messages came in
    const emptyLidsToDelete = (existingAll || [])
      .filter((r: any) => {
        const jid = String(r.participant_jid);
        // Delete if:
        // 1. Is a LID format (@lid)
        // 2. Has no valuable data (no phone, no name)
        // 3. We have enough real JID participants to cover the group
        return isLidFormat(jid) && 
               !r.participant_phone && 
               !r.display_name && 
               realJidCount >= (apiParticipantCount - 1); // -1 because one might be our own profile without data yet
      })
      .map((r: any) => String(r.participant_jid));

    if (emptyLidsToDelete.length) {
      console.log('[evolution-webhook-receiver] [SYNC] Deleting empty LIDs:', emptyLidsToDelete.length, '(have', realJidCount, 'real JIDs for', apiParticipantCount, 'API participants)');
      await supabase
        .from('group_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .in('participant_jid', emptyLidsToDelete);
    }
  } catch (e) {
    console.log('[evolution-webhook-receiver] syncGroupParticipantsSnapshot failed:', e);
  }
}

async function resolveOrganizationForWebhook(supabase: any, instanceParam: string | null, organizationIdParam: string | null) {
  let organizationId: string | null = organizationIdParam;
  let organization: any = null;

  if (!organizationId && instanceParam) {
    const { data: orgByInstance, error } = await supabase
      .from('organizations')
      .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
      .eq('instance_name', instanceParam)
      .single();
    if (!error && orgByInstance) {
      organization = orgByInstance;
      organizationId = orgByInstance.id;
    } else {
      const { data: orgBySlug, error: slugError } = await supabase
        .from('organizations')
        .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
        .eq('slug', instanceParam)
        .single();
      if (!slugError && orgBySlug) {
        organization = orgBySlug;
        organizationId = orgBySlug.id;
      }
    }
  } else if (organizationId) {
    const { data: orgById } = await supabase
      .from('organizations')
      .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
      .eq('id', organizationId)
      .single();
    if (orgById) organization = orgById;
  }

  return { organizationId, organization };
}

function extractGroupJidFromEvent(body: any): string | null {
  const candidates = [
    body?.data?.id,
    body?.data?.groupJid,
    body?.data?.group?.id,
    body?.data?.group?.remoteJid,
    body?.data?.key?.remoteJid,
    body?.data?.remoteJid,
  ];

  for (const c of candidates) {
    const s = c ? String(c) : '';
    if (s.includes('@g.us')) return s;
  }

  // Fallback: search inside payload
  try {
    const match = JSON.stringify(body).match(/\d+@g\.us/);
    return match?.[0] ?? null;
  } catch {
    return null;
  }
}

async function handleGroupEvent(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
  try {
    const { organizationId, organization } = await resolveOrganizationForWebhook(supabase, instanceParam, organizationIdParam);
    if (!organizationId || !organization) {
      return new Response(JSON.stringify({ error: 'Could not resolve organization from instance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groupJid = extractGroupJidFromEvent(body);
    if (!groupJid) {
      return new Response(JSON.stringify({ ignored: true, reason: 'missing_groupJid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionConfig = await getEvolutionConfig(supabase, organization);
    if (!evolutionConfig) {
      return new Response(JSON.stringify({ ignored: true, reason: 'no_evolution_config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groupInfo = await fetchGroupInfo(evolutionConfig, groupJid);
    const groupPhoto = await fetchProfilePicture(evolutionConfig, groupJid);

    const subject = String(groupInfo?.subject || 'Grupo');
    const size = typeof groupInfo?.size === 'number' ? groupInfo.size : null;

    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('phone', groupJid)
      .maybeSingle();

    if (!existingChat?.id) {
      const { data: created, error: createErr } = await supabase
        .from('chats')
        .insert({
          phone: groupJid,
          organization_id: organizationId,
          is_group: true,
          agent_off: true,
          wa_name: subject,
          group_name: subject,
          group_photo_url: groupPhoto,
          participant_count: size,
          last_message: '',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      if (created?.id && groupInfo) {
        await syncGroupParticipantsSnapshot(supabase, organizationId, created.id, groupInfo);
      }
    } else {
      await supabase
        .from('chats')
        .update({
          group_name: subject,
          wa_name: subject,
          group_photo_url: groupPhoto,
          participant_count: size,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingChat.id);

      if (groupInfo) {
        await syncGroupParticipantsSnapshot(supabase, organizationId, existingChat.id, groupInfo);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.log('[evolution-webhook-receiver] handleGroupEvent failed:', e);
    return new Response(JSON.stringify({ error: 'group_event_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Get base64 from media message via Evolution API
async function getBase64FromMedia(config: EvolutionApiConfig, messageKeyId: string, convertToMp4: boolean = false): Promise<any> {
  const apiUrl = `${config.url}/chat/getBase64FromMediaMessage/${config.instanceName}`;
  
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Attempting to convert media');
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] API URL:', apiUrl);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Message Key ID:', messageKeyId);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Instance:', config.instanceName);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Convert to MP4:', convertToMp4);
  
  try {
    const requestBody = {
      message: { key: { id: messageKeyId } },
      convertToMp4,
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[evolution-webhook-receiver] [MEDIA DEBUG] API error response:', errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Got response data');
    console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Has base64:', !!data?.base64);
    console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Base64 length:', data?.base64?.length || 0);
    
    return data;
  } catch (err) {
    console.error('[evolution-webhook-receiver] [MEDIA DEBUG] Exception in getBase64FromMedia:', err);
  }
  return null;
}

// Add "Lead Frio" tag to new chats
async function addLeadFrioTag(supabase: any, chatId: string, organizationId: string): Promise<void> {
  try {
    // Find the "Lead Frio" tag
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', '%lead frio%')
      .maybeSingle();

    if (tag) {
      // Add tag to chat
      await supabase
        .from('chat_tags')
        .insert({
          chat_id: chatId,
          tag_id: tag.id,
          organization_id: organizationId,
        });
      console.log('[evolution-webhook-receiver] Added Lead Frio tag to chat:', chatId);
    }
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error adding Lead Frio tag:', err);
  }
}

// Clean evolution data to remove encrypted/binary content
function cleanEvolutionData(data: any): any {
  if (!data) return null;
  
  try {
    const cleaned = JSON.parse(JSON.stringify(data));
    
    // Clean message object from encrypted media data
    if (cleaned.message) {
      // Remove jpegThumbnail from all media types
      if (cleaned.message.imageMessage?.jpegThumbnail) {
        delete cleaned.message.imageMessage.jpegThumbnail;
      }
      if (cleaned.message.videoMessage?.jpegThumbnail) {
        delete cleaned.message.videoMessage.jpegThumbnail;
      }
      if (cleaned.message.documentMessage?.jpegThumbnail) {
        delete cleaned.message.documentMessage.jpegThumbnail;
      }
      if (cleaned.message.stickerMessage?.pngThumbnail) {
        delete cleaned.message.stickerMessage.pngThumbnail;
      }
      
      // Remove encrypted file hashes
      if (cleaned.message.audioMessage) {
        delete cleaned.message.audioMessage.fileEncSha256;
        delete cleaned.message.audioMessage.fileSha256;
        delete cleaned.message.audioMessage.mediaKey;
        delete cleaned.message.audioMessage.directPath;
      }
      if (cleaned.message.imageMessage) {
        delete cleaned.message.imageMessage.fileEncSha256;
        delete cleaned.message.imageMessage.fileSha256;
        delete cleaned.message.imageMessage.mediaKey;
        delete cleaned.message.imageMessage.directPath;
      }
      if (cleaned.message.videoMessage) {
        delete cleaned.message.videoMessage.fileEncSha256;
        delete cleaned.message.videoMessage.fileSha256;
        delete cleaned.message.videoMessage.mediaKey;
        delete cleaned.message.videoMessage.directPath;
      }
      if (cleaned.message.documentMessage) {
        delete cleaned.message.documentMessage.fileEncSha256;
        delete cleaned.message.documentMessage.fileSha256;
        delete cleaned.message.documentMessage.mediaKey;
        delete cleaned.message.documentMessage.directPath;
      }
    }
    
    return cleaned;
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error cleaning evolution data:', err);
    return null;
  }
}

// Dispatch webhook to n8n for AI processing
async function dispatchReceivedWebhook(
  supabase: any,
  messageData: MessageData,
  organizationId: string,
  organization: any,
  chat: any,
  savedMessage: any,
  evolutionConfig: EvolutionApiConfig | null,
  fileUrl: string | null,
  fileName: string | null
): Promise<void> {
  try {
    // Fetch webhooks configured for "received" type
    const { data: webhooks } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('webhook_type', 'received')
      .eq('active', true);

    if (!webhooks || webhooks.length === 0) {
      console.log('[evolution-webhook-receiver] No received webhooks configured for org:', organization.slug);
      return;
    }

    // Determine media-specific URL based on message type
    let audioUrl: string | null = null;
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    let documentUrl: string | null = null;

    if (fileUrl) {
      switch (messageData.messageType) {
        case 'audio':
          audioUrl = fileUrl;
          break;
        case 'image':
          imageUrl = fileUrl;
          break;
        case 'video':
          videoUrl = fileUrl;
          break;
        case 'document':
        case 'pdf':
          documentUrl = fileUrl;
          break;
      }
    }

    // Build payload compatible with n8n workflow
    const payload = {
      // Basic message info (compatible with Info node in n8n)
      chatid: messageData.chatId,
      grupo: messageData.isGroup,
      idmensagem: messageData.messageKeyId,
      telefone: messageData.phone,
      tipo: messageData.messageType,
      message: messageData.content || '',
      
      // Direction of message
      'from-me': messageData.fromMe,
      direction: messageData.fromMe ? 'outgoing' : 'incoming',
      
      // Profile info
      'foto-perfil': chat.wa_photo_url || chat.group_photo_url || '',
      'nome-whatsapp': messageData.isGroup ? messageData.senderName : messageData.pushName || chat.wa_name || '',
      
      // Organization data (for responding)
      organization_id: organizationId,
      instancia: evolutionConfig?.instanceName || organization.instance_name || organization.slug,
      token: evolutionConfig?.apiKey || '',
      
      // Internal IDs
      chat_id: chat.id,
      message_id: savedMessage.id,
      
      // Group info
      group_name: messageData.isGroup ? messageData.groupName : null,
      sender_name: messageData.senderName,
      sender_phone: messageData.senderPhone,
      
      // Original Evolution data (cleaned - without encrypted media)
      evolution_data: cleanEvolutionData(messageData.evolutionData),
      
      // DECRYPTED file URLs (from Supabase Storage)
      file_url: fileUrl,
      file_name: fileName,
      
      // Media-specific URLs (already decrypted)
      audio_url: audioUrl,
      image_url: imageUrl,
      video_url: videoUrl,
      document_url: documentUrl,
      
      // Supabase info (for API calls from n8n)
      supabase_url: Deno.env.get('SUPABASE_URL'),
      supabase_anon_key: Deno.env.get('SUPABASE_ANON_KEY'),
    };

    console.log('[evolution-webhook-receiver] Dispatching to', webhooks.length, 'received webhook(s)');
    console.log('[evolution-webhook-receiver] Message direction:', messageData.fromMe ? 'outgoing (from-me)' : 'incoming (from lead)');

    // Dispatch to all configured webhooks
    for (const webhook of webhooks) {
      try {
        console.log('[evolution-webhook-receiver] Sending to webhook:', webhook.url);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(webhook.headers || {}),
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        console.log('[evolution-webhook-receiver] Webhook response:', response.status);
      } catch (err) {
        console.error('[evolution-webhook-receiver] Error dispatching to webhook:', webhook.url, err);
      }
    }
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error dispatching received webhooks:', err);
  }
}
