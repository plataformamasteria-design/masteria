/**
 * Funções de formatação para o módulo de métricas de vídeo.
 * Funções puras sem dependências externas.
 */

/** Formata valor monetário em BRL — ex: "R$ 1.250,00" */
export function formatVideoCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Formata percentual com 1 casa decimal — ex: "28,4%" */
export function formatVideoPercent(value: number): string {
  if (!isFinite(value)) return "0,0%";
  return value.toFixed(1).replace(".", ",") + "%";
}

/** Formata segundos em formato legível — ex: "45s" ou "1min 30s" */
export function formatVideoSeconds(value: number): string {
  if (!isFinite(value) || value < 0) return "0s";
  if (value < 60) return `${Math.round(value)}s`;
  const min = Math.floor(value / 60);
  const sec = Math.round(value % 60);
  return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
}

/** Trunca texto com "..." no final se exceder maxChars */
export function truncateText(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}

/** Converte data ISO "2024-01-15" para "15/01/24" */
export function formatVideoDate(dateString: string): string {
  if (!dateString || dateString.length < 10) return dateString || "";
  const [y, m, d] = dateString.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
