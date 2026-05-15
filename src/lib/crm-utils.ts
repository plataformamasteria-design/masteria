/**
 * Shared CRM utility functions used across CRM page and table components.
 */

export function tempoNaEtapa(lead: { updated_at?: string | null; created_at?: string | null; preenchido_em?: string | null }): { label: string; days: number; color: string } {
  const ref = lead.updated_at || lead.created_at || lead.preenchido_em;
  if (!ref) return { label: "—", days: 0, color: "" };
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  if (days >= 30) return { label: `${Math.floor(days / 30)} mês${days >= 60 ? "es" : ""}`, days, color: "text-red-400" };
  if (days >= 14) return { label: `${Math.floor(days / 7)} sem.`, days, color: "text-red-400" };
  if (days >= 7) return { label: `${days} dias`, days, color: "text-yellow-400" };
  return { label: days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`, days, color: "text-muted-foreground" };
}
