import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

type PresenceHeartbeatOptions = {
  /** How often we refresh presence while the app is open. */
  intervalMs?: number;
};

/**
 * Simple heartbeat that marks the logged-in user as "online" for the current organization.
 *
 * Backend (Lovable Cloud) considers online when last_seen_at is within a short window.
 */
export function usePresenceHeartbeat(options: PresenceHeartbeatOptions = {}) {
  const { intervalMs = 45_000 } = options;
  const { currentOrganization } = useOrganization();
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!currentOrganization?.id) return;

    const upsert = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const now = new Date().toISOString();
        await (supabase as any)
          .from("user_presence")
          .upsert(
            {
              organization_id: currentOrganization.id,
              user_id: session.user.id,
              last_seen_at: now,
            },
            { onConflict: "organization_id,user_id" }
          );
      } catch {
        // presence is best-effort; do not spam console
      } finally {
        runningRef.current = false;
      }
    };

    const start = async () => {
      await upsert();
      timerRef.current = window.setInterval(upsert, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void upsert();
    };

    void start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentOrganization?.id, intervalMs]);
}
