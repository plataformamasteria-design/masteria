/**
 * Google Calendar helpers — server-side only.
 * Handles OAuth token refresh and Calendar API calls.
 * Suporta todos os tipos de usuário (employees), com fallback para closers.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface StoredTokens {
  google_calendar_token: string | null;
  google_calendar_refresh_token: string | null;
  google_calendar_token_expires_at: string | null;
}

/**
 * Busca tokens de calendar. Tenta employees primeiro, depois closers (fallback).
 */
async function getStoredTokens(identifier: string): Promise<{ tokens: StoredTokens | null; source: "employee" | "closer"; sourceId: string }> {
  // Tentar employees primeiro
  const { data: emp } = await supabase
    .from("employees")
    .select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expires_at, entity_id, cargo")
    .eq("id", identifier)
    .maybeSingle();

  if (emp?.google_calendar_refresh_token) {
    return { tokens: emp, source: "employee", sourceId: identifier };
  }

  // Fallback: o identifier pode ser um closer_id (chamadas legacy)
  const { data: closer } = await supabase
    .from("closers")
    .select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expires_at")
    .eq("id", identifier)
    .maybeSingle();

  if (closer?.google_calendar_refresh_token) {
    return { tokens: closer, source: "closer", sourceId: identifier };
  }

  // Fallback 2: identifier é employeeId, buscar via entity_id na tabela closers
  if (emp?.entity_id) {
    const { data: closerViaEntity } = await supabase
      .from("closers")
      .select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expires_at")
      .eq("id", emp.entity_id)
      .maybeSingle();

    if (closerViaEntity?.google_calendar_refresh_token) {
      return { tokens: closerViaEntity, source: "closer", sourceId: emp.entity_id };
    }
  }

  // Fallback 3: identifier é closerId, buscar employee que tem entity_id = closerId
  const { data: empsViaCloser } = await supabase
    .from("employees")
    .select("id, google_calendar_token, google_calendar_refresh_token, google_calendar_token_expires_at")
    .eq("entity_id", identifier)
    .not("google_calendar_refresh_token", "is", null)
    .limit(1);

  const empViaCloser = empsViaCloser?.[0];
  if (empViaCloser?.google_calendar_refresh_token) {
    return { tokens: empViaCloser, source: "employee", sourceId: empViaCloser.id };
  }

  return { tokens: null, source: "employee", sourceId: identifier };
}

/**
 * Refresh the access token if expired, updating DB.
 * Returns a valid access_token or null.
 * Aceita employeeId ou closerId como identificador.
 */
export async function getValidAccessToken(identifier: string): Promise<string | null> {
  const { tokens, source, sourceId } = await getStoredTokens(identifier);
  if (!tokens?.google_calendar_token) {
    console.error("[GCal] No token found for", identifier, "source:", source);
    return null;
  }

  const expiresAt = tokens.google_calendar_token_expires_at
    ? new Date(tokens.google_calendar_token_expires_at)
    : null;

  // If token is still valid (with 5min buffer), return it
  if (expiresAt && expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return tokens.google_calendar_token;
  }

  console.log("[GCal] Token expired/expiring for", identifier, "- refreshing. Source:", source, "Expires:", expiresAt?.toISOString());

  // Need to refresh
  if (!tokens.google_calendar_refresh_token) {
    console.error("[GCal] No refresh token for", identifier);
    return null;
  }

  const refreshed = await refreshAccessToken(tokens.google_calendar_refresh_token);
  if (!refreshed) {
    console.error("[GCal] Refresh failed for", identifier);
    return null;
  }

  // Save new token na mesma tabela de onde veio
  const newExpires = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
  const updatePayload = {
    google_calendar_token: refreshed.access_token,
    google_calendar_token_expires_at: newExpires,
    ...(refreshed.refresh_token ? { google_calendar_refresh_token: refreshed.refresh_token } : {}),
  };

  const table = source === "employee" ? "employees" : "closers";
  await supabase.from(table).update(updatePayload).eq("id", sourceId);

  return refreshed.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[GCal] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set");
      return null;
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[GCal] Token refresh failed:", res.status, errBody);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error("[GCal] Token refresh error:", err);
    return null;
  }
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  status: string;
  attendees: { email: string; responseStatus: string }[];
  htmlLink: string;
}

function mapEvents(items: Record<string, unknown>[]): CalendarEvent[] {
  return items.map((ev) => ({
    id: ev.id as string,
    summary: (ev.summary as string) || "(Sem título)",
    description: (ev.description as string) || "",
    start: (ev.start as Record<string, string>)?.dateTime || (ev.start as Record<string, string>)?.date || "",
    end: (ev.end as Record<string, string>)?.dateTime || (ev.end as Record<string, string>)?.date || "",
    status: (ev.status as string) || "confirmed",
    attendees: ((ev.attendees as Array<Record<string, string>>) || []).map((a) => ({
      email: a.email || "",
      responseStatus: a.responseStatus || "needsAction",
    })),
    htmlLink: (ev.htmlLink as string) || "",
  }));
}

/**
 * Fetch today's events from Google Calendar.
 * Usa timezone America/Sao_Paulo para garantir que "hoje" é o dia correto no Brasil.
 */
export async function getTodayEvents(identifier: string): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(identifier);
  if (!accessToken) {
    console.error("[GCal] getTodayEvents: no access token for", identifier);
    return [];
  }

  // Calcular início e fim do dia em horário de Brasília (UTC-3)
  const now = new Date();
  const brOffset = -3 * 60; // UTC-3 em minutos
  const brNow = new Date(now.getTime() + (brOffset + now.getTimezoneOffset()) * 60000);
  const startOfDay = new Date(Date.UTC(brNow.getFullYear(), brNow.getMonth(), brNow.getDate(), 3, 0, 0)); // 00:00 BRT = 03:00 UTC
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
    timeZone: "America/Sao_Paulo",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[GCal] getTodayEvents failed:", res.status, errBody.substring(0, 200));
      return [];
    }
    const data = await res.json();
    console.log("[GCal] getTodayEvents for", identifier, "- found", (data.items || []).length, "events. Range:", startOfDay.toISOString(), "to", endOfDay.toISOString());
    return mapEvents(data.items || []);
  } catch (err) {
    console.error("[GCal] getTodayEvents error:", err);
    return [];
  }
}

/**
 * Fetch events for a specific date (YYYY-MM-DD) from Google Calendar.
 * Usa timezone America/Sao_Paulo.
 */
export async function getEventsForDate(identifier: string, date: string): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(identifier);
  if (!accessToken) {
    console.error("[GCal] getEventsForDate: no access token for", identifier);
    return [];
  }

  // date = "YYYY-MM-DD" → calcular início e fim do dia em BRT (UTC-3)
  const [year, month, day] = date.split("-").map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
    timeZone: "America/Sao_Paulo",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[GCal] getEventsForDate failed:", res.status, errBody.substring(0, 200));
      return [];
    }
    const data = await res.json();
    console.log("[GCal] getEventsForDate for", identifier, "date:", date, "- found", (data.items || []).length, "events");
    return mapEvents(data.items || []);
  } catch (err) {
    console.error("[GCal] getEventsForDate error:", err);
    return [];
  }
}

/**
 * Fetch events for the next N days from Google Calendar.
 */
export async function getUpcomingEvents(identifier: string, days: number = 7): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(identifier);
  if (!accessToken) return [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(startOfDay.getTime() + days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[GCal] Events fetch failed:", res.status, errBody.substring(0, 200));
      return [];
    }
    const data = await res.json();
    console.log("[GCal] Fetched", (data.items || []).length, "events for", identifier);
    return mapEvents(data.items || []);
  } catch (err) {
    console.error("[GCal] Events fetch error:", err);
    return [];
  }
}

/**
 * Fetch events for a date range (YYYY-MM-DD to YYYY-MM-DD) from Google Calendar.
 * Usado no sync inicial ao conectar agenda (puxa o mês inteiro).
 */
export async function getEventsForRange(identifier: string, dateFrom: string, dateTo: string): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(identifier);
  if (!accessToken) {
    console.error("[GCal] getEventsForRange: no access token for", identifier);
    return [];
  }

  const [yF, mF, dF] = dateFrom.split("-").map(Number);
  const [yT, mT, dT] = dateTo.split("-").map(Number);
  const startOfRange = new Date(Date.UTC(yF, mF - 1, dF, 3, 0, 0)); // 00:00 BRT
  const endOfRange = new Date(Date.UTC(yT, mT - 1, dT + 1, 3, 0, 0)); // fim do último dia BRT

  const params = new URLSearchParams({
    timeMin: startOfRange.toISOString(),
    timeMax: endOfRange.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
    timeZone: "America/Sao_Paulo",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[GCal] getEventsForRange failed:", res.status, errBody.substring(0, 200));
      return [];
    }
    const data = await res.json();
    console.log("[GCal] getEventsForRange for", identifier, `${dateFrom} → ${dateTo}`, "- found", (data.items || []).length, "events");
    return mapEvents(data.items || []);
  } catch (err) {
    console.error("[GCal] getEventsForRange error:", err);
    return [];
  }
}

/**
 * Check if a user has Google Calendar connected.
 * Aceita employeeId ou closerId.
 */
export async function isGoogleCalendarConnected(identifier: string): Promise<boolean> {
  const { tokens } = await getStoredTokens(identifier);
  return !!tokens?.google_calendar_refresh_token;
}
