import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'editMessage' | 'deleteForEveryone' | 'deleteForPlatform' | 'reactMessage';

interface Body {
  action: Action;
  messageId: string;
  newText?: string;
}

interface EvolutionConfig {
  url: string;
  apiKey: string;
  instanceName: string;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractExternalIdFromEvolutionResponse(json: any): string | null {
  // Different Evolution builds return different shapes
  return (
    json?.key?.id ??
    json?.message?.key?.id ??
    json?.data?.key?.id ??
    json?.data?.message?.key?.id ??
    null
  );
}

function getMessageKeyFromExternalId(externalId: string, remoteJid: string, fromMe: boolean) {
  // Evolution expects a flat key-like object (id/fromMe/remoteJid). Do NOT wrap it again.
  return { id: externalId, remoteJid, fromMe };
}

function normalizeRemoteJid(phone: string, isGroup: boolean): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return raw;

  // If already a jid, keep it.
  if (raw.includes('@')) return raw;

  // Otherwise, build a jid.
  if (isGroup) return `${raw}@g.us`;
  return `${raw.replace(/\D/g, '')}@s.whatsapp.net`;
}

function normalizeEvolutionNumber(phone: string, isGroup: boolean): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return raw;

  // Evolution endpoints that take `number` usually accept either a jid or plain phone.
  // For 1:1, prefer plain digits (matches our sendText/sendMedia usage).
  if (!isGroup) return raw.replace(/\D/g, '');

  // For groups, keep jid if present; otherwise, build group jid.
  return raw.includes('@') ? raw : `${raw}@g.us`;
}

async function getEvolutionConfig(supabaseAdmin: any, organizationId: string, overrideInstanceName?: string | null): Promise<EvolutionConfig | null> {
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('slug, instance_name, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) return null;

  // URL and key can also exist in global_config
  const { data: globalConfig } = await supabaseAdmin
    .from('global_config')
    .select('key, value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);

  const globalEvolutionUrl = globalConfig?.find((c: any) => c.key === 'evolution_api_url')?.value ?? null;
  const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value ?? null;

  const isValidApiKey = (value: string | null): boolean => {
    if (!value) return false;
    return !value.includes('http://') && !value.includes('https://') && value.length > 10;
  };

  const isValidUrl = (value: string | null): boolean => {
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://');
  };

  let evolutionUrl: string | null = null;
  if (isValidUrl(org.evolution_api_url)) evolutionUrl = org.evolution_api_url;
  else if (isValidUrl(globalEvolutionUrl)) evolutionUrl = globalEvolutionUrl;

  let evolutionKey: string | null = null;
  if (isValidApiKey(org.evolution_api_key)) evolutionKey = org.evolution_api_key;
  else if (isValidApiKey(globalEvolutionKey)) evolutionKey = globalEvolutionKey;

  if (!evolutionUrl || !evolutionKey) return null;

  let cleanUrl = evolutionUrl.replace(/\/$/, '');
  cleanUrl = cleanUrl.replace(/\/manager\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/api\/?$/, '');

  const instanceName = overrideInstanceName || org.instance_name || org.slug;
  return { url: cleanUrl, apiKey: evolutionKey, instanceName };
}

async function callEvolutionEdit(config: EvolutionConfig, key: any, number: string, text: string) {
  // Evolution has multiple incompatible payload shapes across versions.
  // We'll try a small set of known variants.
  const keyAltRemote = { ...key, remoteJid: number };
  const variants: Array<{ name: string; body: any }> = [
    // Some builds require "number" at top-level
    { name: 'number_key_text', body: { number, key, text } },
    { name: 'number_key_text_altRemote', body: { number, key: keyAltRemote, text } },
    { name: 'number_key_message', body: { number, key, message: text } },
    { name: 'number_key_message_altRemote', body: { number, key: keyAltRemote, message: text } },
    // Some builds accept flat key fields but still require number
    { name: 'number_flat_text', body: { number, ...key, text } },
    { name: 'number_flat_text_altRemote', body: { number, ...keyAltRemote, text } },
    { name: 'number_flat_message', body: { number, ...key, message: text } },
    { name: 'number_flat_message_altRemote', body: { number, ...keyAltRemote, message: text } },
    // vX: id/fromMe/remoteJid at top-level + text
    { name: 'flat_text', body: { ...key, text } },
    // some builds expect "message" instead of "text" (server does message.replace(...))
    { name: 'flat_message', body: { ...key, message: text } },
    // other builds expect nested key
    { name: 'nested_key_text', body: { key, text } },
    { name: 'nested_key_message', body: { key, message: text } },
  ];

  let lastRaw: string | null = null;
  for (const v of variants) {
    const response = await fetch(`${config.url}/chat/updateMessage/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify(v.body),
    });

    const raw = await response.text();
    lastRaw = raw;

    if (response.ok) {
      console.log(`[message-actions] Evolution edit success (variant=${v.name})`);
      try {
        return JSON.parse(raw);
      } catch {
        return { raw };
      }
    }

    // If Evolution explicitly says the message cannot be edited, stop here.
    // Otherwise, we might fall through to other variants that return a 500 and hide the real reason.
    if (response.status === 400 && raw.includes('Message not compatible')) {
      throw new HttpError(400, `message_not_compatible`);
    }

    // If it's a schema/shape problem, try next variant.
    // If it's some other status, still try next variant but keep the last error.
    console.warn(`[message-actions] Evolution edit failed (variant=${v.name}): ${response.status} - ${raw}`);
  }

  throw new Error(`Evolution edit error: all_variants_failed - ${lastRaw ?? ''}`);
}

async function callEvolutionDeleteForEveryone(config: EvolutionConfig, key: any) {
  const response = await fetch(`${config.url}/chat/deleteMessageForEveryone/${config.instanceName}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
    // Some Evolution versions validate id/fromMe/remoteJid at top-level
    body: JSON.stringify(key),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Evolution delete error: ${response.status} - ${raw}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function callEvolutionReact(config: EvolutionConfig, key: any, reaction: string, number: string) {
  const variants = [
    { url: '/message/sendReaction', body: { key, reaction } },
    { url: '/message/sendReaction', body: { number, key, reaction } },
    { url: '/chat/sendReaction', body: { key, reaction } },
    { url: '/chat/sendReaction', body: { number, key, reaction } }
  ];

  let lastRaw: string | null = null;
  for (const v of variants) {
    const response = await fetch(`${config.url}${v.url}/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify(v.body),
    });

    const raw = await response.text();
    lastRaw = raw;

    if (response.ok) {
      console.log(`[message-actions] Evolution react success (variant=${v.url})`);
      return;
    }

    console.warn(`[message-actions] Evolution react failed (variant=${v.url}): ${response.status} - ${raw}`);
  }

  throw new Error(`Evolution react error: all_variants_failed - ${lastRaw ?? ''}`);
}

function preserveSignature(existingContent: string | null, newBodyText: string) {
  const existing = existingContent ?? '';
  const m = existing.match(/^(\*[^*]+\*\n)([\s\S]*)$/);
  if (m?.[1]) {
    return `${m[1]}${newBodyText}`;
  }
  return newBodyText;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const authHeader = req.headers.get('Authorization') ?? '';

    // Auth client (user context) just for validating session
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.action || !body?.messageId) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_body' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, chat_id, organization_id, content, message_type, is_from_user, private, external_message_id, created_at, deleted_at, platform_deleted_at')
      .eq('id', body.messageId)
      .single();

    if (msgError || !msg) {
      return new Response(JSON.stringify({ success: false, error: 'message_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ownership check: user must belong to the message organization OR be super_admin/sub_admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id')
      .eq('id', userId)
      .maybeSingle();

    // Check if user has super_admin or sub_admin role (can access any organization)
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const isSuperAdmin = userRoles?.some((r: any) => r.role === 'super_admin') ?? false;
    const isSubAdmin = userRoles?.some((r: any) => r.role === 'sub_admin') ?? false;
    const hasOrgAccess = profile?.organization_id === msg.organization_id;

    // Allow if user belongs to org OR is super_admin/sub_admin
    if (!hasOrgAccess && !isSuperAdmin && !isSubAdmin) {
      console.log('[message-actions] Forbidden - userId:', userId, 'userOrgId:', profile?.organization_id, 'msgOrgId:', msg.organization_id);
      return new Response(JSON.stringify({ success: false, error: 'forbidden' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isDeletedForUI = !!(msg.deleted_at || msg.platform_deleted_at);
    if (isDeletedForUI) {
      return new Response(JSON.stringify({ success: false, error: 'already_deleted' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const createdMs = new Date(msg.created_at).getTime();
    const minutes = (Date.now() - createdMs) / 60000;

    if (body.action === 'deleteForPlatform') {
      await supabaseAdmin
        .from('messages')
        .update({ platform_deleted_at: new Date().toISOString() })
        .eq('id', msg.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For WhatsApp actions, validate constraints
    if (msg.private) {
      return new Response(JSON.stringify({ success: false, error: 'cannot_modify_private' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action !== 'reactMessage' && !msg.is_from_user) {
      return new Response(JSON.stringify({ success: false, error: 'only_agent_messages' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!msg.external_message_id) {
      return new Response(JSON.stringify({ success: false, error: 'missing_external_message_id' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: chat, error: chatError } = await supabaseAdmin
      .from('chats')
      .select('phone, channel, is_group')
      .eq('id', msg.chat_id)
      .single();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ success: false, error: 'chat_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolution = await getEvolutionConfig(supabaseAdmin, msg.organization_id, chat.channel);
    if (!evolution) {
      return new Response(JSON.stringify({ success: false, error: 'evolution_not_configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const remoteJid = chat.is_group
      ? normalizeRemoteJid(chat.phone, true)
      : normalizeRemoteJid(chat.phone, false);

    const number = normalizeEvolutionNumber(chat.phone, chat.is_group);

    const key = getMessageKeyFromExternalId(msg.external_message_id, remoteJid, msg.is_from_user);

    if (body.action === 'editMessage') {
      if (msg.message_type !== 'text') {
        return new Response(JSON.stringify({ success: false, error: 'only_text_editable' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (minutes > 15) {
        return new Response(JSON.stringify({ success: false, error: 'edit_window_expired' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newBody = (body.newText ?? '').trim();
      if (!newBody) {
        return new Response(JSON.stringify({ success: false, error: 'empty_text' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newContent = preserveSignature(msg.content, newBody);
      const evolutionResp = await callEvolutionEdit(evolution, key, number, newContent);
      const externalId = extractExternalIdFromEvolutionResponse(evolutionResp) ?? msg.external_message_id;

      await supabaseAdmin
        .from('messages')
        .update({
          content: newContent,
          edited_at: new Date().toISOString(),
          external_message_id: externalId,
        })
        .eq('id', msg.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'deleteForEveryone') {
      if (minutes > 60) {
        return new Response(JSON.stringify({ success: false, error: 'delete_window_expired' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await callEvolutionDeleteForEveryone(evolution, key);
      await supabaseAdmin
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msg.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'reactMessage') {
      const reactionEmoji = body.newText || '';
      await callEvolutionReact(evolution, key, reactionEmoji, number);

      // Update local db
      const { data: currentMsg, error: rErr } = await supabaseAdmin
        .from('messages')
        .select('reactions')
        .eq('id', msg.id)
        .maybeSingle();

      if (!rErr && currentMsg) {
        let existingReactions: Array<{ emoji: string, participant: string }> = Array.isArray(currentMsg.reactions) ? currentMsg.reactions : [];
        const participant = 'me'; // To easily identify the agent reaction

        // Remove existing reaction sent by us
        existingReactions = existingReactions.filter(r => r.participant !== participant);

        if (reactionEmoji) {
          existingReactions.push({ emoji: reactionEmoji, participant });
        }
        await supabaseAdmin
          .from('messages')
          .update({ reactions: existingReactions })
          .eq('id', msg.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'unknown_action' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 200, // By-pass generic supabase-js 500 mask
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('[message-actions] Error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'unknown_error' }), {
      status: 200, // By-pass generic supabase-js 500 mask
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
