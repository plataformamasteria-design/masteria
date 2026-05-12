import React from 'react';
import { formatBrPhoneFromDigits } from './group-participants';

export interface MentionMatch {
  phone: string;
  start: number;
  end: number;
  raw: string;
}

export interface ParticipantInfo {
  name: string | null;
  phone: string;
  jid?: string;
}

/**
 * Regex to detect mentions: @5511999998888 or @+5511999998888
 * Extended to support LIDs (8-20 digits)
 */
const MENTION_PATTERN = /@(\+?\d{8,20})/g;

/**
 * Parse all mentions from a text string
 */
export function parseMentions(text: string): MentionMatch[] {
  if (!text) return [];
  
  const matches: MentionMatch[] = [];
  let match: RegExpExecArray | null;
  
  // Reset regex state
  MENTION_PATTERN.lastIndex = 0;
  
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const phone = match[1].replace(/^\+/, ''); // Remove leading + if present
    matches.push({
      phone,
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
    });
  }
  
  return matches;
}

/**
 * Format phone for display in mention (with name if available)
 */
export function formatMentionDisplay(phone: string, name?: string | null): string {
  const formattedPhone = formatBrPhoneFromDigits(phone);
  if (name && name.trim()) {
    return `${name.trim()}`;
  }
  return formattedPhone || phone;
}

/**
 * Convert phone number to WhatsApp JID format
 */
export function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/**
 * Extract phone digits from a JID
 */
export function jidToPhone(jid: string): string {
  if (!jid) return '';
  return jid.replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * Extract all mention JIDs from message content for Evolution API
 */
export function extractMentionedJids(text: string): string[] {
  const mentions = parseMentions(text);
  return mentions.map(m => phoneToJid(m.phone));
}

/**
 * Check if a text contains any mentions
 */
export function hasMentions(text: string): boolean {
  if (!text) return false;
  MENTION_PATTERN.lastIndex = 0;
  return MENTION_PATTERN.test(text);
}

/**
 * Build a participants lookup map from an array of participants
 * Key: phone or JID token (part before @)
 * Value: ParticipantInfo with name and phone
 * 
 * Indexes by:
 * 1. Phone number (e.g., "558893648549")
 * 2. JID token which can be phone or LID (e.g., "203732327366656")
 */
export function buildParticipantsMap(
  participants: Array<{ participant_jid: string; participant_phone: string; display_name: string | null }>
): Map<string, ParticipantInfo> {
  const map = new Map<string, ParticipantInfo>();
  
  for (const p of participants) {
    const jidToken = p.participant_jid?.split('@')[0] || '';
    const info: ParticipantInfo = {
      name: p.display_name,
      phone: p.participant_phone || '',
      jid: p.participant_jid,
    };
    
    // Index by phone if available (primary key for lookups)
    if (p.participant_phone) {
      map.set(p.participant_phone, info);
    }
    
    // Also index by JID token (works for both real phones and LIDs)
    // This allows resolution of @LID_TOKEN even when different from phone
    if (jidToken) {
      map.set(jidToken, info);
    }
  }
  
  return map;
}

/**
 * Format text with clickable mention elements
 * Returns React nodes with button elements for mentions
 * 
 * @param text - The text content to format
 * @param onMentionClick - Callback when a mention is clicked
 * @param keyPrefix - Prefix for React keys
 * @param participantsMap - Optional map of phone/jidToken -> ParticipantInfo to resolve names
 */
export function formatTextWithMentions(
  text: string,
  onMentionClick?: (phone: string) => void,
  keyPrefix: string = 'mention',
  participantsMap?: Map<string, ParticipantInfo>
): React.ReactNode[] {
  if (!text) return [text];
  
  const mentions = parseMentions(text);
  if (mentions.length === 0) return [text];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  mentions.forEach((mention, idx) => {
    // Add text before this mention
    if (mention.start > lastIndex) {
      parts.push(text.slice(lastIndex, mention.start));
    }
    
    // Try to resolve the name from participantsMap
    let displayName: string;
    const participant = participantsMap?.get(mention.phone);
    
    if (participant?.name && participant.name.trim()) {
      // Show the participant's name
      displayName = participant.name.trim();
    } else {
      // Fallback to formatted phone
      const formattedPhone = formatBrPhoneFromDigits(mention.phone);
      displayName = formattedPhone || mention.phone;
    }
    
    // Add the mention as a clickable button
    parts.push(
      React.createElement('button', {
        key: `${keyPrefix}-${idx}`,
        type: 'button',
        className: 'inline-flex items-center font-semibold text-primary hover:underline cursor-pointer bg-primary/10 px-1 rounded mention-link',
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          // Pass the actual phone for navigation, preferring resolved phone
          const clickPhone = participant?.phone || mention.phone;
          onMentionClick?.(clickPhone);
        },
        title: `Abrir lead: ${participant?.phone || mention.phone}`,
      }, `@${displayName}`)
    );
    
    lastIndex = mention.end;
  });
  
  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}
