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

export async function requireAdminCallerUserId(supabase: any, req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) {
    console.log('[requireAdminCallerUserId] missing authorization header');
    return null;
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    console.log('[requireAdminCallerUserId] authorization header missing Bearer token');
    return null;
  }

  // 1) Preferred: validate JWT via signing-keys using getClaims().
  // This avoids "session missing" issues common with getUser() in token-only flows.
  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      console.log('[requireAdminCallerUserId] auth.getClaims failed', error?.message);
    } else {
      userId = String(data.claims.sub);
    }
  } catch (e) {
    console.log('[requireAdminCallerUserId] auth.getClaims threw', e);
  }

  // 1b) Fallback: validate via getUser() (older environments)
  if (!userId) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user?.id) {
        console.log('[requireAdminCallerUserId] service auth.getUser failed', error?.message);
      } else {
        userId = String(data.user.id);
      }
    } catch (e) {
      console.log('[requireAdminCallerUserId] service auth.getUser threw', e);
    }
  }

  // 2) Fallback: validate via anon client, passing the token explicitly.
  if (!userId) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_PUBLIC_KEY');
    if (!anonKey) {
      console.log('[requireAdminCallerUserId] missing anon key in env');
      return null;
    }

    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      console.log('[requireAdminCallerUserId] anon auth.getUser failed', userErr?.message);
      return null;
    }

    userId = String(userData.user.id);
  }

  const [isSuperRes, isSubRes, isAdminRes] = await Promise.all([
    supabase.rpc('is_super_admin', { _user_id: userId }),
    supabase.rpc('is_sub_admin', { _user_id: userId }),
    supabase.rpc('has_role', { _role: 'admin', _user_id: userId }),
  ]);

  const isAllowed = Boolean(isSuperRes.data) || Boolean(isSubRes.data) || Boolean(isAdminRes.data);
  console.log('[requireAdminCallerUserId] role check', {
    userId,
    isSuper: isSuperRes.data,
    isSub: isSubRes.data,
    isAdmin: isAdminRes.data,
    allowed: isAllowed,
  });
  return isAllowed ? userId : null;
}

export function normalizeDigits(input: string): string {
  return String(input || '').split('@')[0].replace(/\D/g, '');
}

export function isLidFormat(jid: string | null): boolean {
  if (!jid) return false;
  return jid.endsWith('@lid') || jid.includes('@lid');
}

export function looksLikeRealPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  return true;
}

