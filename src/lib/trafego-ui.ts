/**
 * Trunca o nome de um anúncio para mostrar apenas o nome criativo amigável.
 * Regra: corta no primeiro " - [T]" (marcador de teste) ou em 35 chars,
 * o que vier primeiro.
 */
export function truncateAdName(name: string | null | undefined): string {
  if (!name) return "—";
  const tIdx = name.indexOf(" - [T]");
  if (tIdx > 0 && tIdx <= 35) return name.slice(0, tIdx);
  if (tIdx > 0) return name.slice(0, 35).trimEnd() + "…";
  if (name.length <= 35) return name;
  return name.slice(0, 35).trimEnd() + "…";
}
