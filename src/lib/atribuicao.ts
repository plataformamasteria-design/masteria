/**
 * Constantes e helpers para atribuição de campanhas Meta Ads.
 *
 * Antes de 2026-04-03, leads não tinham ad_id populado (webhook GHL
 * ainda não existia). Métricas por campanha antes dessa data são
 * incompletas por design, não por bug.
 */

/** Data em que o webhook GHL passou a popular ad_id em leads_crm */
export const ATRIBUICAO_INICIO_DATA = '2026-04-03'

/** Formato brasileiro para exibição em UI */
export const ATRIBUICAO_INICIO_LABEL = '03/04/2026'

/**
 * Retorna true se a data fornecida é >= ATRIBUICAO_INICIO_DATA,
 * ou seja, período com atribuição de campanhas disponível.
 */
export function isPeriodoComAtribuicao(data: Date | string): boolean {
  const d = typeof data === 'string' ? data.slice(0, 10) : data.toISOString().slice(0, 10)
  return d >= ATRIBUICAO_INICIO_DATA
}

/**
 * Verifica se um período de consulta inclui datas anteriores à virada.
 * Retorna { mostrar, mensagem } para exibir aviso na UI.
 */
export function avisoAtribuicaoIncompleta(periodo: {
  inicio: Date | string
  fim: Date | string
}): { mostrar: boolean; mensagem: string } {
  const inicio =
    typeof periodo.inicio === 'string'
      ? periodo.inicio.slice(0, 10)
      : periodo.inicio.toISOString().slice(0, 10)

  // Comparar por mes: se o mes do inicio e >= mes da data de corte (2026-04),
  // nao mostrar aviso. Antes comparava por dia exato, o que fazia abril/26
  // (inicio 2026-04-01) mostrar aviso erroneamente (corte = 2026-04-03).
  const mesInicio = inicio.slice(0, 7)
  const mesCorte = ATRIBUICAO_INICIO_DATA.slice(0, 7)
  if (mesInicio >= mesCorte) {
    return { mostrar: false, mensagem: '' }
  }

  return {
    mostrar: true,
    mensagem: `Atribuição de campanhas disponível a partir de ${ATRIBUICAO_INICIO_LABEL}. Para períodos anteriores, métricas por campanha podem aparecer incompletas.`,
  }
}
