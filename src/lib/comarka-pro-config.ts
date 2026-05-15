// Categorias do Comarka Pro — agora vêm da tabela comarka_pro_categorias.
// Este módulo expõe helpers server-side para buscar categorias do DB.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface CategoriaDB {
  id: string;
  nome: string;
  descricao: string;
  pontos: number;
  tipo: "positivo" | "penalidade";
  recorrente: boolean;
  ativo: boolean;
  created_at: string;
}

let _supa: SupabaseClient | null = null;
function getSupa(): SupabaseClient {
  if (_supa) return _supa;
  _supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
  );
  return _supa;
}

/** Busca todas as categorias ativas do DB. Resultado cacheado por 60s em memória. */
let _cache: { data: CategoriaDB[]; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function getCategoriasAtivas(): Promise<CategoriaDB[]> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data;
  const { data, error } = await getSupa()
    .from("comarka_pro_categorias")
    .select("*")
    .eq("ativo", true)
    .order("tipo")
    .order("nome");
  if (error) {
    console.error("[comarka-pro-config] erro ao buscar categorias:", error);
    return _cache?.data ?? [];
  }
  _cache = { data: data as CategoriaDB[], ts: Date.now() };
  return _cache.data;
}

/** Busca uma categoria pelo nome. */
export async function getCategoriaPorNome(nome: string): Promise<CategoriaDB | null> {
  const cats = await getCategoriasAtivas();
  return cats.find((c) => c.nome === nome) ?? null;
}

/** Retorna pontos default de uma categoria pelo nome. */
export async function getPontosCategoria(nome: string): Promise<number | null> {
  const cat = await getCategoriaPorNome(nome);
  return cat?.pontos ?? null;
}

/** Invalida cache para forçar re-fetch após insert. */
export function invalidateCategoriasCache(): void {
  _cache = null;
}
