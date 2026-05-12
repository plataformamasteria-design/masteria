import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  formatBrPhoneFromDigits,
  getParticipantDisplayName,
  getParticipantInitial,
} from "@/lib/group-participants";

type GroupParticipantRow = {
  id: string;
  participant_phone: string;
  participant_jid: string;
  display_name: string | null;
  is_admin: boolean;
};

type LeadRow = {
  id: string;
  phone: string;
  wa_name: string | null;
  custom_name: string | null;
  wa_photo_url: string | null;
};

function onlyDigits(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

function getBestLeadName(lead?: Partial<LeadRow> | null, fallbackPhoneDigits?: string) {
  const name = String(lead?.custom_name || lead?.wa_name || "").trim();
  if (name) return name;
  return formatBrPhoneFromDigits(String(fallbackPhoneDigits || "")) || String(lead?.phone || "");
}

export function GroupParticipantsList(props: {
  organizationId: string;
  groupChatId: string;
}) {
  const { organizationId, groupChatId } = props;
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupParticipantRow[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [leadByDigits, setLeadByDigits] = useState<Record<string, LeadRow>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMembers = async (opts?: { silent?: boolean }) => {
    if (!organizationId || !groupChatId) return;
    if (!opts?.silent && mountedRef.current) setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("group_participants")
        .select("id, participant_phone, participant_jid, display_name, is_admin, updated_at")
        .eq("group_chat_id", groupChatId)
        .order("is_admin", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) return;
      if (!mountedRef.current) return;
      setMembers((data || []) as any);
    } finally {
      if (!opts?.silent && mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!organizationId || !groupChatId) return;
      setLoading(true);
      try {
        await loadMembers({ silent: true });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [organizationId, groupChatId]);

  useEffect(() => {
    if (!organizationId || !groupChatId) return;

    // Auto-refresh on participant snapshot changes.
    const channel = supabase
      .channel(`group_participants:${groupChatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_participants",
          filter: `group_chat_id=eq.${groupChatId}`,
        },
        () => {
          // Keep UI fresh without flashing loading state
          void loadMembers({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, groupChatId]);

  const visibleMembers = useMemo(() => members.slice(0, pageSize), [members, pageSize]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!organizationId) return;
      if (!visibleMembers.length) return;

      const digits = Array.from(
        new Set(
          visibleMembers
            .map((m) => onlyDigits(m.participant_phone))
            .filter(Boolean)
        )
      );

      // Avoid refetching what we already have.
      const missingDigits = digits.filter((d) => !leadByDigits[d]);
      if (!missingDigits.length) return;

      // Try both raw digits and possible JIDs for matching.
      const jids = visibleMembers
        .map((m) => String(m.participant_jid || "").trim())
        .filter(Boolean);

      const candidates = Array.from(new Set([...missingDigits, ...jids]));

      const { data, error } = await supabase
        .from("chats")
        .select("id, phone, wa_name, custom_name, wa_photo_url")
        .eq("organization_id", organizationId)
        .eq("is_group", false)
        .in("phone", candidates)
        .limit(Math.min(500, candidates.length));

      if (!mounted) return;
      if (error) return;

      const next: Record<string, LeadRow> = { ...leadByDigits };
      for (const row of (data || []) as any[]) {
        const r: LeadRow = {
          id: String(row.id),
          phone: String(row.phone || ""),
          wa_name: row.wa_name ? String(row.wa_name) : null,
          custom_name: row.custom_name ? String(row.custom_name) : null,
          wa_photo_url: row.wa_photo_url ? String(row.wa_photo_url) : null,
        };
        const d = onlyDigits(r.phone);
        if (d) next[d] = r;
      }
      setLeadByDigits(next);
    };

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, visibleMembers, pageSize]);

  return (
    <div className="space-y-3">
      {visibleMembers.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          {loading ? "Carregando participantes…" : "Nenhum participante encontrado."}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-background/40">
          <div className="p-3">
            <div className="space-y-3">
              {visibleMembers.map((m, idx) => {
                const digits = onlyDigits(m.participant_phone);
                const lead = digits ? leadByDigits[digits] : undefined;
                const name = lead ? getBestLeadName(lead, digits) : getParticipantDisplayName(m);
                const phone = formatBrPhoneFromDigits(digits) || m.participant_phone;
                const initial = lead ? (getBestLeadName(lead, digits).charAt(0) || "?").toUpperCase() : getParticipantInitial(m);

                return (
                  <div key={m.id}>
                    <div className="flex items-center gap-3">
                      <Avatar className={cn("h-9 w-9", m.is_admin && "ring-2 ring-primary")}
                      >
                        <AvatarImage src={lead?.wa_photo_url || undefined} />
                        <AvatarFallback>{initial}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{name}</p>
                          {m.is_admin && (
                            <span className="text-[10px] rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{phone}</p>
                      </div>
                    </div>
                    {idx < visibleMembers.length - 1 && <Separator className="my-3" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {members.length > pageSize && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => setPageSize((s) => s + 10)}>
            Expandir (+10)
          </Button>
        </div>
      )}
    </div>
  );
}
