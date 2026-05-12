import { extractAdTrackingData } from '../services/adTracker.ts';
import { EvolutionApiConfig, QuotedPreview, MessageData, ALLOWED_INTERNAL_MESSAGE_TYPES } from '../types.ts';
import { uploadToR2 } from '../../_shared/r2-client.ts';
import { maybeSendAutoMessages } from '../services/autoResponder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// Handle message update (edit) event
export async function handleMessageUpdate(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
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
    const isError = (isAckNumValid && ackNum === -1) || (statusText ? ['ERROR', 'FAILED', 'REJECTED'].some((s) => statusText.includes(s)) : false);

    if (isDelivered || isRead || isError) {
      const nowIso = new Date().toISOString();

      if (isError) {
        let errorMessage = "Erro desconhecido (WhatsApp rejeitou ou número inválido)";
        if (data?.error?.message) errorMessage = data.error.message;
        else if (data?.message?.error) errorMessage = data.message.error;
        else if (typeof data?.error === 'string') errorMessage = data.error;

        await supabase
          .from('messages')
          .update({ failed_at: nowIso, error_message: errorMessage })
          .eq('id', existingMessage.id)
          .is('failed_at', null);

        console.log('[evolution-webhook-receiver] ❌ Message failed:', { messageId: existingMessage.id, errorMessage });
      }

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
        failed: isError,
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
export async function handleMessageDelete(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
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
export function detectMessageType(message: any): string {
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.audioMessage) return 'audio';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.documentMessage) return 'document';
  if (message.locationMessage) return 'location';
  if (message.contactMessage || message.contactsArrayMessage) return 'contact';
  if (message.stickerMessage) return 'sticker';
  if (message.templateMessage) return 'templateMessage';
  if (message.templateButtonReplyMessage) return 'templateButtonReplyMessage';
  if (message.buttonsResponseMessage) return 'buttonsResponseMessage';
  if (message.listResponseMessage) return 'listResponseMessage';
  if (message.reactionMessage) return 'reactionMessage';
  return 'unknown';
}

// Map Evolution message types to internal types
export function mapMessageType(evolutionType: string): string {
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
    'buttonsMessage': 'text',
    'listMessage': 'text',
    'templateMessage': 'text',
    'templateButtonReplyMessage': 'text',
    'buttonsResponseMessage': 'text',
    'listResponseMessage': 'text',
    'pollCreationMessage': 'system',
    'pollUpdateMessage': 'system',
  };

  const mapped = mapping[evolutionType] || evolutionType;
  if (ALLOWED_INTERNAL_MESSAGE_TYPES.has(mapped)) return mapped;
  if (ALLOWED_INTERNAL_MESSAGE_TYPES.has(String(mapped).toLowerCase())) return String(mapped).toLowerCase();
  return 'system';
}

// Extract text content from message
export function extractTextContent(message: any, messageType: string): string | null {
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;

  // Extrair reações
  if (message.reactionMessage?.text) return message.reactionMessage.text;

  // Extrair respostas de templates, botões e listas
  if (message.templateButtonReplyMessage?.selectedDisplayText) return message.templateButtonReplyMessage.selectedDisplayText;
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;

  // Extrair templates enviados (Ex: Quando a plataforma ou o atendente envia um botões/template)
  if (message.templateMessage?.hydratedTemplate?.hydratedContentText) return message.templateMessage.hydratedTemplate.hydratedContentText;
  if (message.templateMessage?.hydratedFourRowTemplate?.hydratedContentText) return message.templateMessage.hydratedFourRowTemplate.hydratedContentText;
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
export function extractMentionedJidsFromPayload(message: any, rawMessage: any, data: any): string[] {
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
export function isLidToken(token: string): boolean {
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
export function resolveLidMentionsInText(text: string, mentionedJids: string[]): string {
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
export async function resolveLidMentionsWithFallback(
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

export function unwrapMessage(message: any): any {
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

export async function tryHandleProtocolMessage(
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

export function extractQuotedExternalMessageId(message: any): string | null {
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

export function uniqStrings(arr: any[]): string[] {
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

export function findFirstQuotedIdInMessage(root: any): string | null {
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

export async function findMessageByExternalIds(
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

export function extractQuotedPreviewFromPayload(message: any): QuotedPreview | null {
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
export function getMimeType(message: any, messageType: string): string {
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
export function getFileName(message: any, messageType: string, fallbackName?: string): string {
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
export async function getEvolutionConfig(supabase: any, org: any): Promise<EvolutionApiConfig | null> {
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
export async function fetchProfilePicture(config: EvolutionApiConfig, phone: string): Promise<string | null> {
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
export async function fetchGroupInfo(config: EvolutionApiConfig, groupJid: string): Promise<any> {
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

export function normalizeDigits(input: string): string {
  return String(input || '').split('@')[0].replace(/\D/g, '');
}

// Helper to check if a JID is a LID (Linked ID) format
export function isLidFormat(jid: string | null): boolean {
  if (!jid) return false;
  return jid.endsWith('@lid') || jid.includes('@lid');
}

// Check if a phone string looks like a valid real phone (not LID garbage)
export function looksLikeRealPhone(phone: string | null): boolean {
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
export function resolveRealPhoneFromGroupInfo(params: {
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
export async function updateGroupParticipantFromMessage(params: {
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

export async function syncGroupParticipantsSnapshot(supabase: any, organizationId: string, groupChatId: string, groupInfo: any) {
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

export async function resolveOrganizationForWebhook(supabase: any, instanceParam: string | null, organizationIdParam: string | null) {
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

export function extractGroupJidFromEvent(body: any): string | null {
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

export async function handleGroupEvent(supabase: any, body: any, instanceParam: string | null, organizationIdParam: string | null) {
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
export async function getBase64FromMedia(config: EvolutionApiConfig, waMessage: any, convertToMp4: boolean = false): Promise<any> {
  const apiUrl = `${config.url}/chat/getBase64FromMediaMessage/${config.instanceName}`;

  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Attempting to convert media');
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] API URL:', apiUrl);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Message Key ID:', waMessage?.key?.id);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Instance:', config.instanceName);
  console.log('[evolution-webhook-receiver] [MEDIA DEBUG] Convert to MP4:', convertToMp4);

  try {
    const requestBody = {
      message: waMessage,
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
export async function addLeadFrioTag(supabase: any, chatId: string, organizationId: string): Promise<void> {
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

// Add "Anúncio" tag to chats coming from ads
export async function addAdTag(supabase: any, chatId: string, organizationId: string): Promise<void> {
  try {
    // 1. Check if an "Anúncio" or "Ad" tag exists
    let { data: tags } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', organizationId)
      .or('name.ilike.%anúncio%,name.ilike.%ad%')
      .limit(1);

    let tagId = tags?.[0]?.id;

    // 2. If it doesn't exist, create it
    if (!tagId) {
      const { data: newTag, error: createErr } = await supabase
        .from('tags')
        .insert({
          organization_id: organizationId,
          name: 'Anúncio',
          color: '#ef4444' // red color for ads
        })
        .select('id')
        .single();

      if (createErr) {
        console.error('[evolution-webhook-receiver] Error creating Anúncio tag:', createErr);
        return;
      }
      tagId = newTag?.id;
    }

    // 3. Prevent duplicate applying
    if (tagId) {
      const { data: existingChatTag } = await supabase
        .from('chat_tags')
        .select('id')
        .eq('chat_id', chatId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (!existingChatTag) {
        await supabase
          .from('chat_tags')
          .insert({
            chat_id: chatId,
            tag_id: tagId,
            organization_id: organizationId,
          });
        console.log('[evolution-webhook-receiver] Added Anúncio tag to chat:', chatId);
      }
    }
  } catch (err) {
    console.error('[evolution-webhook-receiver] Error adding Anúncio tag:', err);
  }
}

// Clean evolution data to remove encrypted/binary content
export function cleanEvolutionData(data: any): any {
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
export async function dispatchReceivedWebhook(
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
