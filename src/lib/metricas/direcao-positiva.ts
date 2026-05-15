/**
 * Define a direcao em que variacao positiva e "boa" para cada metrica.
 * Usado pelo CardKPI para colorir a tendencia corretamente.
 *
 * 'up'   = subir e bom (verde quando sobe)
 * 'down' = descer e bom (verde quando desce)
 * 'flat' = neutra (sempre cinza)
 */
export const DIRECAO_POSITIVA: Record<string, "up" | "down" | "flat"> = {
  investimento: "flat",
  leads: "up",
  qualificados: "up",
  reunioes_agendadas: "up",
  reunioes_realizadas: "up",
  clientes_fechados: "up",
  cpl: "down",
  cprf: "down",
  cac_bruto: "down",
  roas_bruto: "up",
  payback_bruto_meses: "down",
  mrr_gerado: "up",
  ltv_total: "up",
  taxa_qualificacao: "up",
  taxa_agendamento: "up",
  taxa_comparecimento: "up",
  taxa_fechamento: "up",
  taxa_lead_cliente: "up",
  no_show: "down",
  ctr: "up",
  ctr_link: "up",
  cpm: "down",
  cpc: "down",
  frequencia: "flat",
  ticket_medio: "up",
  pct_atribuicao: "up",
  impressoes: "up",
  alcance: "up",
  // Metricas de aquisicao (/projecoes/aquisicao)
  cac_real: "down",
  payback_real: "down",
  ltv_real_descontado: "up",
  roas_real: "up",
  margem_mensal_cliente: "up",
  custo_servir_unitario: "down",
  roas_cash_ref: "up",
};
