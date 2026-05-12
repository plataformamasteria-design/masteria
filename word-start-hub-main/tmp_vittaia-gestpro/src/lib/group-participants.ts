export type GroupParticipantPreview = {
  id: string;
  participant_phone: string;
  display_name: string | null;
  is_admin: boolean;
};

function onlyDigits(input: string): string {
  return String(input || '').replace(/\D/g, '');
}

export function formatBrPhoneFromDigits(rawDigits: string): string {
  const digits = onlyDigits(rawDigits);
  if (!digits) return '';

  // Best-effort BR formatting.
  // Examples:
  // 5511999998888 => +55 11 99999-8888
  // 5511988887777 => +55 11 98888-7777
  // Fallback: just return digits.

  const hasCountry = digits.startsWith('55') && digits.length >= 12;
  const d = hasCountry ? digits.slice(2) : digits;

  if (d.length < 10) return hasCountry ? `+55 ${d}` : d;

  const area = d.slice(0, 2);
  const rest = d.slice(2);

  if (rest.length === 9) {
    return `${hasCountry ? '+55 ' : ''}${area} ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  if (rest.length === 8) {
    return `${hasCountry ? '+55 ' : ''}${area} ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return `${hasCountry ? '+55 ' : ''}${area} ${rest}`;
}

export function getParticipantDisplayName(p: Pick<GroupParticipantPreview, 'display_name' | 'participant_phone'>): string {
  const name = String(p.display_name || '').trim();
  if (name) return name;
  const phone = formatBrPhoneFromDigits(p.participant_phone);
  return phone || p.participant_phone;
}

export function getParticipantInitial(p: Pick<GroupParticipantPreview, 'display_name' | 'participant_phone'>): string {
  const base = getParticipantDisplayName(p);
  return String(base || '?').trim().charAt(0).toUpperCase() || '?';
}

export async function fetchGroupParticipantsPreview(params: {
  supabase: any;
  groupChatIds: string[];
  limitPerGroup?: number;
}): Promise<Record<string, GroupParticipantPreview[]>> {
  const { supabase, groupChatIds, limitPerGroup = 5 } = params;
  const ids = (groupChatIds || []).filter(Boolean);
  if (!ids.length) return {};

  // Fetch a reasonable cap and group client-side.
  // Note: PostgREST doesn't support "limit per group" natively.
  const { data, error } = await supabase
    .from('group_participants')
    .select('id, group_chat_id, participant_phone, display_name, is_admin, updated_at')
    .in('group_chat_id', ids)
    .order('is_admin', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(Math.min(2000, ids.length * Math.max(limitPerGroup, 5)));

  if (error) return {};

  const rows = (data || []) as Array<
    GroupParticipantPreview & {
      group_chat_id: string;
      updated_at?: string;
    }
  >;

  const map: Record<string, GroupParticipantPreview[]> = {};
  for (const r of rows) {
    const key = String(r.group_chat_id);
    if (!map[key]) map[key] = [];
    if (map[key].length >= limitPerGroup) continue;
    map[key].push({
      id: String(r.id),
      participant_phone: String(r.participant_phone || ''),
      display_name: r.display_name ? String(r.display_name) : null,
      is_admin: Boolean(r.is_admin),
    });
  }

  return map;
}
