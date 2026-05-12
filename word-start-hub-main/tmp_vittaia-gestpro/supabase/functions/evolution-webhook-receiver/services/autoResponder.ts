import { EvolutionApiConfig } from "../types.ts";

export type BusinessHours = {
    days: number[]; // 0=Dom, 1=Seg ... 6=Sáb
    start: string; // HH:mm
    end: string; // HH:mm
    lunch_enabled: boolean;
    lunch_start: string;
    lunch_end: string;
};

export type AutoMessagesConfig = {
    welcome_enabled: boolean;
    welcome_message: string | null;
    welcome_inactive_hours: number;
    away_enabled: boolean;
    away_message: string | null;
    business_hours: BusinessHours;
    timezone: string;
};

export function parseTimeToMinutes(value: string): number {
    const [h, m] = (value || '00:00').split(':').map((v) => Number(v));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function getZonedParts(date: Date, timeZone: string): { weekday: number; minutes: number } {
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

export function isWithinBusinessHours(now: Date, cfg: AutoMessagesConfig): boolean {
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

export async function sendTextToEvolution(config: EvolutionApiConfig, phone: string, text: string) {
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

    try {
        const parsed = JSON.parse(body);
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

export async function maybeSendAutoMessages(params: {
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

    const inBusiness = isWithinBusinessHours(now, cfg);
    console.log('[evolution-webhook-receiver] [AUTO] inBusiness:', inBusiness);

    if (inBusiness && cfg.welcome_enabled && cfg.welcome_message?.trim()) {
        const inactiveHours = Number(cfg.welcome_inactive_hours || 24);
        const inactiveMs = inactiveHours * 60 * 60 * 1000;
        const cutoffTime = new Date(now.getTime() - inactiveMs).toISOString();

        const { data: recentOutboundMessages, error: outboundErr } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_id', chat.id)
            .eq('is_from_user', true)
            .gte('created_at', cutoffTime)
            .limit(1);

        if (outboundErr) {
            console.log('[evolution-webhook-receiver] [AUTO] Error checking outbound messages:', outboundErr);
        }

        const hadRecentOutbound = recentOutboundMessages && recentOutboundMessages.length > 0;
        const welcomeCooldownOk = !lastWelcomeSentAt || now.getTime() - lastWelcomeSentAt.getTime() >= inactiveMs;

        if (!hadRecentOutbound && welcomeCooldownOk) {
            try {
                console.log('[evolution-webhook-receiver] [AUTO] Sending welcome message (no outbound in last 24h)');
                const sent = await sendTextToEvolution(evolutionConfig, phone, cfg.welcome_message.trim());

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

    if (!inBusiness && cfg.away_enabled && cfg.away_message?.trim()) {
        const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours
        const awayCooldownOk = !lastAwaySentAt || now.getTime() - lastAwaySentAt.getTime() >= cooldownMs;
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

    await supabase.from('chats').update(updates).eq('id', chat.id);
}
