import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DynamicDistributionSettings = {
  enabled: boolean;
  assignment_target?: { team_id?: string | null };
  metric?: "least_open_chats";
  include_only_online?: boolean;
  reassign_on_offline?: boolean;
  periodic_enabled?: boolean;
  periodic_interval_minutes?: number;
};

function asBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return fallback;
}

function getTeamIdFromSettings(cfg: DynamicDistributionSettings | null): string | null {
  return (cfg?.assignment_target?.team_id as string | null) ?? null;
}

async function getOnlineUserIds(params: {
  supabase: any;
  organizationId: string;
  onlineCutoffIso: string;
}): Promise<Set<string>> {
  const { supabase, organizationId, onlineCutoffIso } = params;
  const { data, error } = await supabase
    .from("user_presence")
    .select("user_id,last_seen_at")
    .eq("organization_id", organizationId)
    .gte("last_seen_at", onlineCutoffIso);
  if (error) throw error;
  return new Set<string>((data || []).map((r: any) => String(r.user_id)));
}

async function getTeamMemberUserIds(params: {
  supabase: any;
  organizationId: string;
  teamId: string;
}): Promise<Set<string>> {
  const { supabase, organizationId, teamId } = params;
  const { data, error } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("team_id", teamId);
  if (error) throw error;
  return new Set<string>((data || []).map((r: any) => String(r.user_id)));
}

async function getApprovedAgents(params: { supabase: any; organizationId: string }): Promise<Set<string>> {
  const { supabase, organizationId } = params;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("approved", true);
  if (error) throw error;
  return new Set<string>((data || []).map((r: any) => String(r.id)));
}

async function buildLoadMap(params: { supabase: any; organizationId: string; candidateIds: string[] }) {
  const { supabase, organizationId, candidateIds } = params;
  const load = new Map<string, number>();
  for (const id of candidateIds) load.set(id, 0);

  if (candidateIds.length === 0) return load;

  // We count open chats per agent (resolved_at IS NULL)
  const { data, error } = await supabase
    .from("chats")
    .select("assigned_to")
    .eq("organization_id", organizationId)
    .is("resolved_at", null)
    .in("assigned_to", candidateIds);

  if (error) throw error;

  for (const row of data || []) {
    const id = row.assigned_to ? String(row.assigned_to) : null;
    if (!id) continue;
    load.set(id, (load.get(id) || 0) + 1);
  }

  return load;
}

function pickLeastLoaded(load: Map<string, number>) {
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
}

async function assignChats(params: {
  supabase: any;
  organizationId: string;
  teamId: string;
  candidateIds: string[];
  settings: DynamicDistributionSettings;
  onlineSet: Set<string>;
}) {
  const { supabase, organizationId, teamId, candidateIds, settings, onlineSet } = params;

  // Build current load (least open chats)
  const load = await buildLoadMap({ supabase, organizationId, candidateIds });

  let assigned = 0;
  let reassigned = 0;

  // 1) Assign backlog (unassigned)
  const { data: backlog, error: backlogErr } = await supabase
    .from("chats")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("team_id", teamId)
    .is("assigned_to", null)
    .is("resolved_at", null)
    .limit(200);
  if (backlogErr) throw backlogErr;

  for (const chat of backlog || []) {
    const pick = pickLeastLoaded(load);
    if (!pick) break;
    const { error } = await supabase
      .from("chats")
      .update({ assigned_to: pick, assigned_at: new Date().toISOString() })
      .eq("id", chat.id);
    if (!error) {
      assigned++;
      load.set(pick, (load.get(pick) || 0) + 1);
    }
  }

  // 2) Reassign chats from offline agents — ONLY if reassign_on_offline is enabled
  if (asBool(settings.reassign_on_offline, true)) {
    const { data: offlineChats, error: offErr } = await supabase
      .from("chats")
      .select("id,assigned_to")
      .eq("organization_id", organizationId)
      .eq("team_id", teamId)
      .is("resolved_at", null)
      .not("assigned_to", "is", null)
      .limit(200);
    if (offErr) throw offErr;

    for (const row of offlineChats || []) {
      const current = row.assigned_to ? String(row.assigned_to) : null;
      if (!current) continue;
      if (onlineSet.has(current)) continue;

      const pick = pickLeastLoaded(load);
      if (!pick) break;
      if (pick === current) continue;

      const { error } = await supabase
        .from("chats")
        .update({ assigned_to: pick, assigned_at: new Date().toISOString() })
        .eq("id", row.id);
      if (!error) {
        reassigned++;
        load.set(pick, (load.get(pick) || 0) + 1);
      }
    }
  }

  return { assigned, reassigned };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") || "";
  const isInternal = authHeader === `Bearer ${serviceKey}`;
  const service = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Auth for manual calls (admin/sub_admin/super_admin)
  let callerUserId: string | null = null;
  if (!isInternal) {
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error,
    } = await authed.auth.getUser();

    if (error || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    callerUserId = user.id;

    // Prefer canonical role checks via database functions (avoids relying on a row existing in user_roles)
    const [isSuperRes, isSubRes, isAdminRes] = await Promise.all([
      service.rpc("is_super_admin", { _user_id: callerUserId }),
      service.rpc("is_sub_admin", { _user_id: callerUserId }),
      service.rpc("has_role", { _role: "admin", _user_id: callerUserId }),
    ]);

    const isAllowed =
      Boolean(isSuperRes.data) || Boolean(isSubRes.data) || Boolean(isAdminRes.data);

    if (!isAllowed) {
      // Fallback: allow if a compatible row exists (legacy)
      const { data: roleRow } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", callerUserId)
        .in("role", ["admin", "sub_admin", "super_admin"])
        .maybeSingle();

      if (!roleRow) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  const requestedOrgId = body?.organization_id ? String(body.organization_id) : null;
  const trigger = String(body?.trigger || "unknown");

  const now = new Date();
  const onlineCutoff = new Date(now.getTime() - 3 * 60 * 1000); // 3 min cutoff (heartbeat is 45s)
  const onlineCutoffIso = onlineCutoff.toISOString();

  try {
    let orgs: any[] = [];
    if (requestedOrgId) {
      const { data, error } = await service
        .from("organizations")
        .select("id, settings")
        .eq("id", requestedOrgId)
        .maybeSingle();
      if (error) throw error;
      if (data) orgs = [data];
    } else {
      const { data, error } = await service.from("organizations").select("id, settings");
      if (error) throw error;
      orgs = data || [];
    }

    let totalAssigned = 0;
    let totalReassigned = 0;
    const perOrg: any[] = [];

    for (const org of orgs) {
      const cfg = (org.settings?.dynamic_distribution ?? null) as DynamicDistributionSettings | null;
      if (!cfg || !asBool(cfg.enabled)) continue;

      // periodic gate
      if (trigger === "cron" && !asBool(cfg.periodic_enabled, true)) continue;

      const teamId = getTeamIdFromSettings(cfg);
      if (!teamId) continue;

      const includeOnlyOnline = asBool(cfg.include_only_online, true);
      const reassignOnOffline = asBool(cfg.reassign_on_offline, true);

      const approved = await getApprovedAgents({ supabase: service, organizationId: org.id });
      const teamMembers = await getTeamMemberUserIds({
        supabase: service,
        organizationId: org.id,
        teamId,
      });
      const online = includeOnlyOnline
        ? await getOnlineUserIds({ supabase: service, organizationId: org.id, onlineCutoffIso })
        : new Set<string>();

      const candidates: string[] = [];
      for (const id of Array.from(teamMembers.values())) {
        if (!approved.has(id)) continue;
        if (includeOnlyOnline && !online.has(id)) continue;
        candidates.push(id);
      }

      if (candidates.length === 0) {
        perOrg.push({ organization_id: org.id, assigned: 0, reassigned: 0, reason: "no_candidates" });
        continue;
      }

      const onlineSet: Set<string> = includeOnlyOnline ? online : new Set<string>(candidates);
      const { assigned, reassigned } = await assignChats({
        supabase: service,
        organizationId: org.id,
        teamId,
        candidateIds: candidates,
        settings: cfg,
        onlineSet,
      });

      totalAssigned += assigned;
      totalReassigned += reassigned;
      perOrg.push({ organization_id: org.id, assigned, reassigned, candidates: candidates.length });
    }

    return new Response(
      JSON.stringify({ ok: true, trigger, assigned: totalAssigned, reassigned: totalReassigned, per_org: perOrg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[dynamic-distribution-processor] error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
