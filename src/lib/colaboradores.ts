import { supabase } from "@/lib/supabase";

export interface ColaboradorComMapeamento {
  id: string;
  nome: string;
  ativo: boolean;
  tipo: "closer" | "sdr";
  nivel?: string | null;
  meta_conversao_reuniao?: number | null;
  ghl_mapeado: boolean;
  ghl_user_id?: string | null;
}

export async function getClosers(): Promise<ColaboradorComMapeamento[]> {
  const { data: closers } = await supabase
    .from("closers")
    .select("id, nome, ativo, nivel, meta_conversao_reuniao")
    .eq("ativo", true)
    .order("nome");

  if (!closers || closers.length === 0) return [];

  const ids = closers.map((c) => c.id);
  const { data: maps } = await supabase
    .from("ghl_user_map")
    .select("supabase_id, ghl_user_id")
    .eq("tipo", "closer")
    .in("supabase_id", ids);

  const mapLookup = new Map((maps || []).map((m) => [m.supabase_id, m.ghl_user_id]));

  return closers.map((c) => ({
    id: c.id,
    nome: c.nome,
    ativo: c.ativo,
    tipo: "closer" as const,
    nivel: c.nivel,
    meta_conversao_reuniao: c.meta_conversao_reuniao,
    ghl_mapeado: mapLookup.has(c.id),
    ghl_user_id: mapLookup.get(c.id) || null,
  }));
}

export async function getSdrs(): Promise<ColaboradorComMapeamento[]> {
  const { data: sdrs } = await supabase
    .from("sdrs")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");

  if (!sdrs || sdrs.length === 0) return [];

  const ids = sdrs.map((s) => s.id);
  const { data: maps } = await supabase
    .from("ghl_user_map")
    .select("supabase_id, ghl_user_id")
    .eq("tipo", "sdr")
    .in("supabase_id", ids);

  const mapLookup = new Map((maps || []).map((m) => [m.supabase_id, m.ghl_user_id]));

  return sdrs.map((s) => ({
    id: s.id,
    nome: s.nome,
    ativo: s.ativo,
    tipo: "sdr" as const,
    ghl_mapeado: mapLookup.has(s.id),
    ghl_user_id: mapLookup.get(s.id) || null,
  }));
}

export async function getColaboradorComMapeamento(
  id: string,
  tipo: "closer" | "sdr",
): Promise<ColaboradorComMapeamento | null> {
  const table = tipo === "closer" ? "closers" : "sdrs";
  const select = tipo === "closer"
    ? "id, nome, ativo, nivel, meta_conversao_reuniao"
    : "id, nome, ativo";

  const { data } = await supabase
    .from(table)
    .select(select)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const { data: map } = await supabase
    .from("ghl_user_map")
    .select("ghl_user_id")
    .eq("supabase_id", id)
    .eq("tipo", tipo)
    .maybeSingle();

  return {
    id: data.id,
    nome: data.nome,
    ativo: data.ativo,
    tipo,
    nivel: (data as Record<string, unknown>).nivel as string | null ?? null,
    meta_conversao_reuniao: (data as Record<string, unknown>).meta_conversao_reuniao as number | null ?? null,
    ghl_mapeado: !!map,
    ghl_user_id: map?.ghl_user_id || null,
  };
}
