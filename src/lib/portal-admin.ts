import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: "Não autenticado", status: 401 as const, session: null };
  if (session.role !== "admin") return { error: "Apenas admin", status: 403 as const, session: null };
  return { error: null, status: 200 as const, session };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return { error: "Não autenticado", status: 401 as const, session: null };
  return { error: null, status: 200 as const, session };
}
