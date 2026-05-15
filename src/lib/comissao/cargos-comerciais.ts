/**
 * cargos-comerciais.ts — Constante centralizada de cargos que recebem comissao.
 *
 * REGRA OFICIAL Lucas — so time comercial (SDR e Closer) recebe comissao.
 * Flag `recebe_comissao` em employees e override pontual (secundario).
 * Cargo e fonte PRIMARIA, flag e override SECUNDARIO.
 */

export const CARGOS_COMERCIAIS = ["sdr", "closer"] as const;

/**
 * Verifica se um cargo e comercial (SDR ou Closer), case-insensitive.
 * Inclui "social seller" como alias historico de SDR.
 */
export function isCargoComercial(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const normalizado = cargo.toLowerCase().trim();
  return (
    CARGOS_COMERCIAIS.some((c) => normalizado.includes(c)) ||
    normalizado === "social seller"
  );
}

/**
 * Determina elegibilidade para comissao baseado no cargo.
 * Regra primaria: so SDR e Closer recebem.
 */
export function recebeComissaoPorCargo(
  cargo: string | null | undefined
): boolean {
  return isCargoComercial(cargo);
}

/**
 * Determina elegibilidade combinada: cargo comercial + flag recebe_comissao.
 * Mesma regra da canonica (comissao-canonica.ts linhas 298-314).
 */
export function isElegivelComissao(colaborador: {
  cargo?: string | null;
  recebe_comissao?: boolean | null;
}): boolean {
  return isCargoComercial(colaborador.cargo) && colaborador.recebe_comissao !== false;
}

/**
 * Determina motivo_zerado para colaborador inelegivel.
 */
export function motivoZerado(
  cargo: string | null | undefined,
  flagRecebeComissao: boolean | null | undefined
): string | undefined {
  if (flagRecebeComissao === false) return "flag_desligada";
  if (!isCargoComercial(cargo)) return "cargo_nao_comercial";
  return undefined;
}
