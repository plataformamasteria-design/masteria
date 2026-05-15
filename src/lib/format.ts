export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number): string {
  if (!isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/**
 * Formata data para DD/MM/AAAA.
 * Aceita Date, string ISO (2026-04-15), ou string YYYY-MM-DD.
 */
export function formatarData(date: Date | string): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T12:00:00") : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousMonth(mesRef: string): string {
  const [year, month] = mesRef.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(mesRef: string): string {
  const [year, month] = mesRef.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Formata ROAS: null/undefined/0 → "—", valor real → "1.23x" */
export function formatRoas(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  return `${value.toFixed(2)}x`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
