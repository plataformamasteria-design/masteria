import useSWR from "swr";

interface PermissaoRow {
  pagina: string;
  pode_ver: boolean;
  pode_editar: boolean;
}

interface CargoPermissaoRow extends PermissaoRow {
  cargo: string;
}

export interface Permissao {
  pode_ver: boolean;
  pode_editar: boolean;
  is_override: boolean;
}

export type PermissoesMap = Record<string, Permissao>;

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Fetch error");
  return r.json();
});

/**
 * Hook que retorna permissões efetivas de um colaborador.
 * Merge: cargo defaults ← overrides individuais.
 *
 * @param colaboradorId - ID do employee
 * @param cargo - cargo normalizado (admin, closer, sdr, social_selling, operacional, etc.)
 */
export function usePermissions(colaboradorId: string | null, cargo: string | null) {
  // Busca permissões de todos os cargos
  const { data: cargoPerms } = useSWR<CargoPermissaoRow[]>(
    "/api/permissoes/cargo",
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 10000 }
  );

  // Busca overrides do colaborador específico
  const { data: overrides } = useSWR<PermissaoRow[]>(
    colaboradorId ? `/api/permissoes/colaborador?id=${colaboradorId}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 10000 }
  );

  // Merge: cargo base + overrides
  const permissoes: PermissoesMap = {};

  if (cargoPerms && cargo) {
    // Filtrar permissões do cargo
    const cargoNorm = normalizeCargo(cargo);
    const cargoRows = cargoPerms.filter((p) => p.cargo === cargoNorm);

    for (const row of cargoRows) {
      permissoes[row.pagina] = {
        pode_ver: row.pode_ver,
        pode_editar: row.pode_editar,
        is_override: false,
      };
    }
  }

  // Aplicar overrides individuais
  if (overrides) {
    for (const ov of overrides) {
      permissoes[ov.pagina] = {
        pode_ver: ov.pode_ver,
        pode_editar: ov.pode_editar,
        is_override: true,
      };
    }
  }

  return {
    permissoes,
    podeVer: (pagina: string) => permissoes[pagina]?.pode_ver ?? false,
    podeEditar: (pagina: string) => permissoes[pagina]?.pode_editar ?? false,
    isOverride: (pagina: string) => permissoes[pagina]?.is_override ?? false,
    loading: !cargoPerms,
  };
}

/**
 * Normaliza o cargo do employees para a chave usada em permissoes_cargo.
 */
export function normalizeCargo(cargo: string): string {
  const c = (cargo || "").toLowerCase().trim();
  if (c === "admin" || c === "diretor" || c === "ceo") return "admin";
  if (c === "closer") return "closer";
  if (c === "sdr") return "sdr";
  if (c.includes("social")) return "social_selling";
  if (c.includes("trafego") || c.includes("tráfego") || c.includes("head") || c.includes("pleno") || c.includes("junior") || c.includes("júnior") || c.includes("operac") || c.includes("desenvolv")) return "operacional";
  return "operacional"; // fallback
}
