import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EvolutionApiConfig {
  url: string;
  apiKey: string;
}

interface CreateInstancePayload {
  instanceName: string;
  phoneNumber?: string;
  webhookUrl: string;
}

type CreateGroupPayload = {
  subject: string;
  description?: string;
  participants?: string[];
};

import { normalizeDigits, isLidFormat, looksLikeRealPhone } from '../utils/helpers.ts';
export async function createWhatsAppGroup(config: EvolutionApiConfig, instanceName: string, payload: CreateGroupPayload) {
  try {
    console.log('Creating WhatsApp group:', { instanceName, subject: payload.subject, hasDescription: !!payload.description });

    const participants = Array.isArray(payload.participants) ? payload.participants : [];

    // Per docs: POST /group/create/{instance}
    // Some builds require participants to be present (at least one). We'll try empty array first.
    const response = await fetch(`${config.url}/group/create/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        subject: payload.subject,
        description: payload.description,
        participants,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('Create group error:', response.status, text);
      return new Response(
        JSON.stringify({
          error: 'Falha ao criar grupo no WhatsApp pela Evolution',
          details: text,
          hint: 'Algumas versões da Evolution exigem pelo menos 1 participante no payload.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error creating WhatsApp group:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function updateGroupParticipants(
  config: EvolutionApiConfig,
  instanceName: string,
  groupJid: string,
  operation: 'add' | 'remove' | 'promote' | 'demote',
  participants: string[]
) {
  try {
    console.log('[group-update-participants]', { instanceName, groupJid, operation, count: participants.length });

    const base = config.url;
    const inst = encodeURIComponent(instanceName);
    const group = encodeURIComponent(groupJid);

    // Evolution builds vary wildly:
    // - Some expose PUT, others only POST
    // - Some expect groupJid in query string, others in body
    // - Some include instance in the path, others as query/body
    // We try the most common variants and return on first success.
    const attempts: Array<{
      name: string;
      method: 'PUT' | 'POST';
      url: string;
      body: Record<string, unknown>;
    }> = [
        {
          name: 'put_query_action',
          method: 'PUT',
          url: `${base}/group/updateParticipant/${inst}?groupJid=${group}`,
          body: { action: operation, participants },
        },
        {
          name: 'post_query_action',
          method: 'POST',
          url: `${base}/group/updateParticipant/${inst}?groupJid=${group}`,
          body: { action: operation, participants },
        },
        {
          name: 'put_body_groupJid_action',
          method: 'PUT',
          url: `${base}/group/updateParticipant/${inst}`,
          body: { groupJid, action: operation, participants },
        },
        {
          name: 'post_body_groupJid_action',
          method: 'POST',
          url: `${base}/group/updateParticipant/${inst}`,
          body: { groupJid, action: operation, participants },
        },
        {
          name: 'post_root_body_instance',
          method: 'POST',
          url: `${base}/group/updateParticipant`,
          body: { instanceName, groupJid, action: operation, participants },
        },
        {
          name: 'post_root_query_instance',
          method: 'POST',
          url: `${base}/group/updateParticipant/${inst}?instance=${inst}&groupJid=${group}`,
          body: { action: operation, participants },
        },
      ];

    let lastErrorText = '';
    let lastStatus = 0;

    for (const a of attempts) {
      const response = await fetch(a.url, {
        method: a.method,
        headers: {
          'Content-Type': 'application/json',
          apikey: config.apiKey,
        },
        body: JSON.stringify(a.body),
      });

      const text = await response.text();
      if (response.ok) {
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        console.log('[group-update-participants] success via attempt:', a.name);
        return new Response(JSON.stringify({ success: true, data, attempt: a.name }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lastStatus = response.status;
      lastErrorText = text;
      console.log('[group-update-participants] attempt failed:', a.name, response.status, text);

      // If method isn't supported, try next attempt.
      // Evolution returns different shapes, but this text is a clear signal.
      if (text?.includes?.('Cannot PUT') || text?.includes?.('Cannot POST')) {
        continue;
      }
    }

    console.error('Update participants error:', lastStatus, lastErrorText);
    return new Response(
      JSON.stringify({ error: 'Falha ao atualizar participantes do grupo', details: lastErrorText }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating group participants:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function getGroupInviteCode(config: EvolutionApiConfig, instanceName: string, groupJid: string) {
  try {
    console.log('[group-invite]', { instanceName, groupJid });
    const response = await fetch(
      `${config.url}/group/inviteCode/${encodeURIComponent(instanceName)}?groupJid=${encodeURIComponent(groupJid)}`,
      {
        method: 'GET',
        headers: { apikey: config.apiKey },
      }
    );

    const text = await response.text();
    if (!response.ok) {
      console.error('Invite code error:', response.status, text);
      return new Response(
        JSON.stringify({ error: 'Falha ao obter link de convite', details: text }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching group invite code:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function fetchGroupInfoFromEvolution(
  config: EvolutionApiConfig,
  instanceName: string,
  groupJid: string
): Promise<any | null> {
  try {
    const inst = encodeURIComponent(instanceName);
    const group = encodeURIComponent(groupJid);

    // Most common endpoint (also used by webhook receiver)
    const url = `${config.url}/group/findGroupInfos/${inst}?groupJid=${group}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { apikey: config.apiKey },
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.log('[group-info] evolution failed:', resp.status, text);
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (e) {
    console.log('[group-info] fetchGroupInfoFromEvolution error:', e);
    return null;
  }
}

export async function syncGroupParticipantsSnapshot(params: {
  supabase: any;
  organizationId: string;
  groupChatId: string;
  groupJid: string;
  groupInfo: any;
}): Promise<boolean> {
  const { supabase, organizationId, groupChatId, groupInfo } = params;

  const participantsRaw = Array.isArray(groupInfo?.participants)
    ? groupInfo.participants
    : Array.isArray(groupInfo?.data?.participants)
      ? groupInfo.data.participants
      : [];

  // Fetch existing participants to preserve their data if new data is empty
  const { data: existingParticipantsData } = await supabase
    .from('group_participants')
    .select('participant_jid, participant_phone, display_name')
    .eq('group_chat_id', groupChatId);

  const existingMap = new Map<string, { participant_jid: string; participant_phone: string | null; display_name: string | null }>(
    (existingParticipantsData || []).map((p: any) => [p.participant_jid, p])
  );

  // Also create a map by phone to find existing records saved with different JID
  const existingByPhone = new Map<string, { participant_jid: string; participant_phone: string | null; display_name: string | null }>();
  (existingParticipantsData || []).forEach((p: any) => {
    if (p.participant_phone && p.participant_phone !== '') {
      existingByPhone.set(p.participant_phone, p);
    }
  });

  const normalized = (participantsRaw || [])
    .map((p: any) => {
      const rawJid = String(p?.id || p?.jid || p?.participant || p?.remoteJid || '').trim();
      if (!rawJid) return null;

      // WhatsApp group participants can come as LIDs in rawJid (e.g. "2037...@lid")
      // but the REAL phone contact is in participantAlt (e.g. "5588...@s.whatsapp.net").
      const participantAltRaw = String(p?.participantAlt || '').trim();

      // Determine participant_jid: prefer participantAlt (@s.whatsapp.net) to make mentions work in WhatsApp
      let participantJid = rawJid;
      if (participantAltRaw && participantAltRaw.includes('@s.whatsapp.net')) {
        participantJid = participantAltRaw;
      }

      // Determine real phone number:
      // 1. Prefer participantAlt (most reliable)
      // 2. Prefer p.phone or p.number
      // 3. If JID is not LID, extract digits from JID
      let participantPhone: string | null = null;

      // PRIORITY 1: participantAlt
      if (participantAltRaw && participantAltRaw.includes('@s.whatsapp.net')) {
        const altPhone = participantAltRaw.split('@')[0].replace(/\D/g, '');
        if (looksLikeRealPhone(altPhone)) participantPhone = altPhone;
      }

      // PRIORITY 2: p.phone/p.number
      if (!participantPhone) {
        const rawPhone = p?.phone || p?.number;
        if (rawPhone && looksLikeRealPhone(rawPhone)) {
          participantPhone = normalizeDigits(rawPhone);
        }
      }

      // PRIORITY 3: extract from non-LID jid
      if (!participantPhone && !isLidFormat(rawJid)) {
        const extracted = normalizeDigits(rawJid);
        if (looksLikeRealPhone(extracted)) {
          participantPhone = extracted;
        }
      }

      if (!participantPhone && isLidFormat(rawJid)) {
        console.log('[group-info] [SYNC] LID participant without participantAlt/phone:', rawJid);
      }

      const isAdmin = Boolean(p?.admin || p?.isAdmin || p?.is_admin || p?.superAdmin || p?.super_admin);
      const displayName = p?.notify || p?.name || p?.pushName || null;

      // Check if we have existing data for this participant
      const existingByJid = existingMap.get(participantJid);

      // Also check if we have an existing record by phone (might be saved with different JID)
      const existingByPhoneRecord = participantPhone ? existingByPhone.get(participantPhone) : null;

      return {
        participant_jid: participantJid,
        // Preserve existing phone if new is empty
        participant_phone: participantPhone || existingByJid?.participant_phone || existingByPhoneRecord?.participant_phone || '',
        is_admin: isAdmin,
        // Preserve existing display_name if new is empty
        display_name: displayName ? String(displayName) : existingByJid?.display_name || existingByPhoneRecord?.display_name || null,
      };
    })
    .filter(Boolean) as Array<{ participant_jid: string; participant_phone: string; is_admin: boolean; display_name: string | null }>;

  // Count how many participants with real data we already have
  const participantsWithData = (existingParticipantsData || []).filter((p: any) =>
    (p.participant_phone && p.participant_phone !== '') || p.display_name
  ).length;
  const apiParticipantCount = participantsRaw.length;

  // Filter out empty LIDs if we already have enough participants with data
  // This prevents creating "ghost" participants when we already have the real ones
  const toUpsert = normalized.filter((p) => {
    const isEmptyLid = isLidFormat(p.participant_jid) && !p.participant_phone && !p.display_name;
    if (isEmptyLid && participantsWithData >= apiParticipantCount) {
      console.log('[group-info] [SYNC] Skipping empty LID (have enough data):', p.participant_jid);
      return false;
    }
    return true;
  });

  // Upsert current list (filtered to exclude redundant empty LIDs)
  if (toUpsert.length) {
    console.log('[group-info] [SYNC] Upserting', toUpsert.length, 'participants (filtered from', normalized.length, ')');
    const rows = toUpsert.map((p) => ({
      organization_id: organizationId,
      group_chat_id: groupChatId,
      participant_jid: p.participant_jid,
      participant_phone: p.participant_phone,
      display_name: p.display_name,
      is_admin: p.is_admin,
    }));

    const { error: upErr } = await supabase
      .from('group_participants')
      .upsert(rows, { onConflict: 'group_chat_id,participant_jid' });
    if (upErr) {
      console.log('[group-info] upsert group_participants failed:', upErr);
    }
  }

  // Delete members that are no longer present - BUT PRESERVE those with valuable data
  try {
    const keepJids = new Set(toUpsert.map((p) => p.participant_jid));
    const { data: existing } = await supabase
      .from('group_participants')
      .select('participant_jid, participant_phone, display_name')
      .eq('group_chat_id', groupChatId)
      .limit(2000);

    // Count how many real JID participants with data we have
    const realJidCount = (existing || []).filter((r: any) =>
      String(r.participant_jid).includes('@s.whatsapp.net') &&
      ((r.participant_phone && r.participant_phone !== '') || r.display_name)
    ).length;

    // Only delete participants that:
    // 1. Are NOT in the groupInfo list
    // 2. AND don't have valuable data (phone or display_name)
    const toDelete = (existing || [])
      .filter((r: any) => {
        const jid = String(r.participant_jid);
        const hasValuableData = (r.participant_phone && r.participant_phone !== '') || r.display_name;

        if (!jid) return false;
        if (keepJids.has(jid)) return false; // In sync list, keep
        if (hasValuableData) {
          console.log('[group-info] [SYNC] Preserving participant with valuable data:', jid, 'phone:', r.participant_phone, 'name:', r.display_name);
          return false; // Has valuable data, keep
        }
        return true; // Not in sync list AND no valuable data, delete
      })
      .map((r: any) => String(r.participant_jid));

    if (toDelete.length) {
      console.log('[group-info] [SYNC] Cleaning up', toDelete.length, 'participants without valuable data');
      await supabase
        .from('group_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .in('participant_jid', toDelete);
    }

    // AGGRESSIVE CLEANUP: Delete empty LIDs when we have enough real JID participants
    // This handles the case where LIDs were created before messages came in
    const emptyLidsToDelete = (existing || [])
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
      console.log('[group-info] [SYNC] Deleting empty LIDs:', emptyLidsToDelete.length, '(have', realJidCount, 'real JIDs for', apiParticipantCount, 'API participants)');
      await supabase
        .from('group_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .in('participant_jid', emptyLidsToDelete);
    }
  } catch (e) {
    console.log('[group-info] cleanup participants failed (non-fatal):', e);
  }

  // Determine if the WhatsApp instance is an admin in this group
  try {
    const { data: conn } = await supabase
      .from('whatsapp_connections')
      .select('phone_number')
      .eq('organization_id', organizationId)
      .maybeSingle();
    const selfPhone = conn?.phone_number ? normalizeDigits(String(conn.phone_number)) : '';
    if (!selfPhone) return false;
    const self = normalized.find((p) => p.participant_phone === selfPhone);
    return Boolean(self?.is_admin);
  } catch {
    return false;
  }
}

export async function enrichGroupParticipants(params: {
  supabase: any;
  evolutionConfig: EvolutionApiConfig;
  instanceName: string;
  organizationId: string;
  groupJid: string;
}): Promise<Response> {
  const { supabase, evolutionConfig, instanceName, organizationId, groupJid } = params;

  try {
    console.log('[enrich-group-participants] Starting enrichment for:', groupJid);

    // Get the chat for this group
    const { data: chatRow, error: chatErr } = await supabase
      .from('chats')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('phone', groupJid)
      .maybeSingle();

    if (chatErr || !chatRow?.id) {
      return new Response(
        JSON.stringify({ error: 'group_not_found', message: 'Grupo não encontrado na plataforma.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch fresh group info from Evolution
    const groupInfo = await fetchGroupInfoFromEvolution(evolutionConfig, instanceName, groupJid);
    if (!groupInfo) {
      return new Response(
        JSON.stringify({ error: 'evolution_error', message: 'Não foi possível buscar informações do grupo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current participants with unresolved phones (LID-like)
    const { data: existingParticipants } = await supabase
      .from('group_participants')
      .select('id, participant_jid, participant_phone, display_name')
      .eq('group_chat_id', chatRow.id)
      .limit(500);

    const participantsRaw = Array.isArray(groupInfo?.participants)
      ? groupInfo.participants
      : Array.isArray(groupInfo?.data?.participants)
        ? groupInfo.data.participants
        : [];

    let enrichedCount = 0;

    // Try to resolve real phones from the fresh group info
    for (const existing of existingParticipants || []) {
      // Check if current phone looks like a LID (too many digits or not starting with country code)
      const currentPhone = existing.participant_phone || '';
      const looksLikeUnresolved = currentPhone.length > 13 || (!currentPhone.startsWith('55') && currentPhone.length > 12);

      if (!looksLikeUnresolved) continue; // Already has a real phone

      // Find this participant in the fresh groupInfo
      const match = participantsRaw.find((p: any) => {
        const pJid = String(p?.id || p?.jid || p?.participant || p?.remoteJid || '');
        return pJid === existing.participant_jid;
      });

      if (match) {
        // Try to get real phone from p.phone or p.number
        const realPhone = match?.phone || match?.number;
        if (realPhone && looksLikeRealPhone(realPhone)) {
          const normalizedPhone = normalizeDigits(realPhone);
          const displayName = match?.notify || match?.name || match?.pushName || existing.display_name;

          await supabase
            .from('group_participants')
            .update({
              participant_phone: normalizedPhone,
              display_name: displayName ? String(displayName) : existing.display_name,
            })
            .eq('id', existing.id);

          enrichedCount++;
          console.log('[enrich-group-participants] Resolved:', existing.participant_jid, '->', normalizedPhone);
        }
      }
    }

    // Also sync the full list (this will add any new participants)
    await syncGroupParticipantsSnapshot({
      supabase,
      organizationId,
      groupChatId: chatRow.id,
      groupJid,
      groupInfo,
    });

    return new Response(
      JSON.stringify({ success: true, enrichedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[enrich-group-participants] Error:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', details: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function updateGroupPicture(
  config: EvolutionApiConfig,
  instanceName: string,
  groupJid: string,
  pictureUrl: string
) {
  try {
    console.log('[group-update-picture]', { instanceName, groupJid, hasUrl: !!pictureUrl });

    const base = config.url;
    const inst = encodeURIComponent(instanceName);
    const group = encodeURIComponent(groupJid);

    // Different Evolution builds accept different payload keys.
    // We'll try URL first, since the UI uploads to a public URL.
    const payloadVariants: Array<{ key: string; body: Record<string, unknown> }> = [
      // Most common per Evolution docs:
      { key: 'image_string', body: { image: pictureUrl } },
      { key: 'image_url_object', body: { image: { url: pictureUrl } } },
      // Common alternates seen in forks/builds:
      { key: 'url', body: { url: pictureUrl } },
      { key: 'pictureUrl', body: { pictureUrl } },
      { key: 'imageUrl', body: { imageUrl: pictureUrl } },
    ];

    // Builds also vary by method and by how they pass groupJid.
    // We'll try a matrix of endpoint + method + payload.
    const requestVariants: Array<{
      name: string;
      method: 'PUT' | 'POST';
      url: string;
      wrapBody: (body: Record<string, unknown>) => Record<string, unknown>;
    }> = [
        // Some builds validate a schema that expects `instance.image` (yes, nested).
        {
          name: 'post_query_instance_wrapper',
          method: 'POST',
          url: `${base}/group/updateGroupPicture/${inst}?groupJid=${group}`,
          wrapBody: (b) => ({ instance: { ...b } }),
        },
        {
          name: 'post_body_groupJid_instance_wrapper',
          method: 'POST',
          url: `${base}/group/updateGroupPicture/${inst}`,
          wrapBody: (b) => ({ groupJid, instance: { ...b } }),
        },
        {
          name: 'post_body_groupJid_instance_wrapper_inside',
          method: 'POST',
          url: `${base}/group/updateGroupPicture/${inst}`,
          wrapBody: (b) => ({ instance: { groupJid, ...b } }),
        },
        {
          name: 'post_query',
          method: 'POST',
          url: `${base}/group/updateGroupPicture/${inst}?groupJid=${group}`,
          wrapBody: (b) => b,
        },
        {
          name: 'put_query',
          method: 'PUT',
          url: `${base}/group/updateGroupPicture/${inst}?groupJid=${group}`,
          wrapBody: (b) => b,
        },
        {
          name: 'put_body_groupJid',
          method: 'PUT',
          url: `${base}/group/updateGroupPicture/${inst}`,
          wrapBody: (b) => ({ groupJid, ...b }),
        },
        {
          name: 'post_body_groupJid',
          method: 'POST',
          url: `${base}/group/updateGroupPicture/${inst}`,
          wrapBody: (b) => ({ groupJid, ...b }),
        },
        {
          name: 'post_root_body_instance',
          method: 'POST',
          url: `${base}/group/updateGroupPicture`,
          wrapBody: (b) => ({ instanceName, groupJid, ...b }),
        },
      ];

    let lastStatus = 0;
    let lastText = '';

    for (const rv of requestVariants) {
      for (const pv of payloadVariants) {
        const response = await fetch(rv.url, {
          method: rv.method,
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey,
          },
          body: JSON.stringify(rv.wrapBody(pv.body)),
        });

        const text = await response.text();
        if (response.ok) {
          let data: any = null;
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
          console.log('[group-update-picture] success via attempt:', `${rv.name}:${pv.key}`);
          return new Response(JSON.stringify({ success: true, data, attempt: `${rv.name}:${pv.key}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastStatus = response.status;
        lastText = text;
        console.log('[group-update-picture] attempt failed:', `${rv.name}:${pv.key}`, response.status, text);

        if (text?.includes?.('Cannot PUT') || text?.includes?.('Cannot POST')) {
          // keep trying
          continue;
        }
      }
    }

    const looksLikeForbiddenFetch =
      lastText?.includes?.('status code 403') ||
      lastText?.includes?.('Request failed with status code 403') ||
      lastText?.includes?.('403');

    return new Response(
      JSON.stringify({
        error: 'Falha ao atualizar foto do grupo',
        details: lastText || 'All attempts failed',
        hint: looksLikeForbiddenFetch
          ? 'A Evolution não conseguiu baixar a imagem (403). Use uma URL pública direta (recomendado: upload pela plataforma) e evite links que bloqueiam hotlink (ex.: alguns CDNs/sites).'
          : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating group picture:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

