import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin, SessionPayload } from "@/lib/session";

// Cliente Supabase com service role — uso server-side apenas.
let _admin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"),
  );
  return _admin;
}

// ---------- helpers de data ----------

/** Primeiro dia do mês (UTC) como Date. */
export function primeiroDiaMes(d: Date | string): Date {
  const dt = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1));
}

/** ISO YYYY-MM-DD do primeiro dia do mês. */
export function mesRefISO(d: Date | string): string {
  return primeiroDiaMes(d).toISOString().slice(0, 10);
}

export function mesAnteriorISO(d: Date | string): string {
  const p = primeiroDiaMes(d);
  p.setUTCMonth(p.getUTCMonth() - 1);
  return p.toISOString().slice(0, 10);
}

/** Retorna array de ISO dates [mes - (n-1) ... mes]. */
export function ultimosNMesesISO(d: Date | string, n: number): string[] {
  const out: string[] = [];
  const base = primeiroDiaMes(d);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(base.getTime());
    m.setUTCMonth(m.getUTCMonth() - i);
    out.push(m.toISOString().slice(0, 10));
  }
  return out;
}

export function inicioSemanaISO(d: Date = new Date()): string {
  const dt = new Date(d.getTime());
  const dow = dt.getUTCDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow; // segunda
  dt.setUTCDate(dt.getUTCDate() + diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

export function ehFimDeSemana(d: Date = new Date()): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

// ---------- autorização ----------

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

/**
 * Quem pode lançar pontos manuais, aprovar roteiros/feedbacks e acessar /admin:
 * - Super-admin (usuario='lucas')
 * - Employees com cargo='head' (padrão do projeto)
 * - Employees com is_head_operacional=true (flag nova desta migration)
 */
export async function isAdminOrHead(session: SessionPayload | null): Promise<boolean> {
  if (!session) return false;
  if (isSuperAdmin(session)) return true;
  if ((session.cargo || "").toLowerCase() === "head") return true;
  const supa = getSupabaseAdmin();
  const { data } = await supa
    .from("employees")
    .select("is_head_operacional")
    .eq("id", session.employeeId)
    .maybeSingle();
  return !!data?.is_head_operacional;
}

// ---------- recalcular_pontos_mes ----------

/**
 * Soma lançamentos ativos do colaborador no mês, calcula multiplicador baseado
 * em meses_sequencia armazenado em comarka_pro_pontos, e faz upsert do resumo.
 * Deve ser chamado após qualquer insert/update/soft-delete em lançamentos.
 */
export async function recalcularPontosMes(
  colaborador_id: string,
  mes: Date | string,
): Promise<{ pontos_brutos: number; pontos_finais: number; multiplicador: number } | null> {
  const supa = getSupabaseAdmin();
  const mesISO = mesRefISO(mes);

  // 1. somar lançamentos ativos do mês
  const { data: lancs, error: errLanc } = await supa
    .from("comarka_pro_lancamentos")
    .select("pontos")
    .eq("colaborador_id", colaborador_id)
    .eq("mes_referencia", mesISO)
    .is("deleted_at", null);
  if (errLanc) {
    console.error("[comarka-pro] erro ao somar lançamentos:", errLanc);
    return null;
  }
  const pontos_brutos = (lancs ?? []).reduce((acc, l: any) => acc + (l.pontos ?? 0), 0);

  // 2. buscar config + meses_sequencia atual
  const { data: cfg } = await supa
    .from("comarka_pro_config")
    .select("multiplicador_sequencia, meses_sequencia_necessarios")
    .limit(1)
    .maybeSingle();
  const multSeq = Number(cfg?.multiplicador_sequencia ?? 1.2);
  const mesesNec = Number(cfg?.meses_sequencia_necessarios ?? 3);

  const { data: pontosRow } = await supa
    .from("comarka_pro_pontos")
    .select("meses_sequencia")
    .eq("colaborador_id", colaborador_id)
    .eq("mes_referencia", mesISO)
    .maybeSingle();
  const mesesSeq = Number(pontosRow?.meses_sequencia ?? 0);

  const multiplicador = mesesSeq >= mesesNec ? multSeq : 1.0;
  const pontos_finais = Math.round(pontos_brutos * multiplicador);

  // 3. upsert
  const { error: errUp } = await supa
    .from("comarka_pro_pontos")
    .upsert(
      {
        colaborador_id,
        mes_referencia: mesISO,
        pontos_brutos,
        multiplicador_ativo: multiplicador,
        pontos_finais,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "colaborador_id,mes_referencia" },
    );
  if (errUp) {
    console.error("[comarka-pro] erro upsert pontos:", errUp);
    return null;
  }

  return { pontos_brutos, pontos_finais, multiplicador };
}

// ---------- helpers de lançamento ----------

/** Verifica se já existe lançamento ativo com determinado critério. */
export async function jaExisteLancamento(params: {
  colaborador_id: string;
  mes_referencia: string;
  categoria: string;
  cliente_id?: string | null;
  criado_desde?: string; // ISO timestamp — usado para limitar por semana
}): Promise<boolean> {
  const supa = getSupabaseAdmin();
  let q = supa
    .from("comarka_pro_lancamentos")
    .select("id", { count: "exact", head: true })
    .eq("colaborador_id", params.colaborador_id)
    .eq("categoria", params.categoria)
    .is("deleted_at", null);
  if (params.mes_referencia) q = q.eq("mes_referencia", params.mes_referencia);
  if (params.cliente_id !== undefined) {
    if (params.cliente_id === null) q = q.is("cliente_id", null);
    else q = q.eq("cliente_id", params.cliente_id);
  }
  if (params.criado_desde) q = q.gte("criado_em", params.criado_desde);
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** Conta dias úteis (seg-sex) no mês da data informada. */
export function diasUteisNoMes(ref: Date | string): number {
  const p = primeiroDiaMes(ref);
  const ano = p.getUTCFullYear();
  const mes = p.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const w = new Date(Date.UTC(ano, mes, d)).getUTCDay();
    if (w !== 0 && w !== 6) count++;
  }
  return count;
}

/** Valida CRON_SECRET via header Authorization: Bearer <token>. */
export function validarCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return token === expected;
}
