/**
 * GHL OAuth helper — server-side only.
 * Manages OAuth tokens with automatic refresh.
 * Falls back to GHL_API_KEY env var if no OAuth token exists.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID || "";
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET || "";

const PROVIDER = "ghl";

interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  location_id: string | null;
}

/**
 * Get a valid GHL access token.
 * Priority: OAuth token (with auto-refresh) → GHL_API_KEY env fallback.
 */
export async function getGhlToken(): Promise<string | null> {
  // Try OAuth token first
  const { data: row } = await supabase
    .from("integration_tokens")
    .select("access_token, refresh_token, token_expires_at, location_id")
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (row) {
    const token = await ensureValidToken(row as TokenRow);
    if (token) return token;
  }

  // Fallback to static env key
  return process.env.GHL_API_KEY || null;
}

/**
 * Check if GHL is connected via OAuth.
 */
export async function isGhlOAuthConnected(): Promise<{
  connected: boolean;
  locationId: string | null;
  connectedBy: string | null;
  connectedAt: string | null;
}> {
  const { data } = await supabase
    .from("integration_tokens")
    .select("location_id, connected_by, connected_at")
    .eq("provider", PROVIDER)
    .maybeSingle();

  return {
    connected: !!data,
    locationId: data?.location_id || null,
    connectedBy: data?.connected_by || null,
    connectedAt: data?.connected_at || null,
  };
}

/**
 * Disconnect GHL OAuth — removes token from DB.
 */
export async function disconnectGhl(): Promise<void> {
  await supabase
    .from("integration_tokens")
    .delete()
    .eq("provider", PROVIDER);
}

async function ensureValidToken(row: TokenRow): Promise<string | null> {
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;

  // Still valid (5min buffer)
  if (expiresAt && expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return row.access_token;
  }

  // Need refresh
  if (!row.refresh_token) return null;

  const refreshed = await refreshToken(row.refresh_token);
  if (!refreshed) return null;

  // Save refreshed token
  const newExpires = new Date(Date.now() + (refreshed.expires_in || 86400) * 1000).toISOString();
  await supabase
    .from("integration_tokens")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: newExpires,
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", PROVIDER);

  return refreshed.access_token;
}

async function refreshToken(
  refreshTokenValue: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    const res = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshTokenValue,
      }),
    });
    if (!res.ok) {
      console.error("[GHL OAuth] Refresh failed:", res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (err) {
    console.error("[GHL OAuth] Refresh error:", err);
    return null;
  }
}
