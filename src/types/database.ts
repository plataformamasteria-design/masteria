export interface Closer {
  id: string;
  nome: string;
  usuario: string | null;
  senha_hash: string | null;
  ativo: boolean;
  nivel: string;
  salario_fixo: number;
  meta_conversao_reuniao: number;
  meta_conversao_mql: number;
  meta_ticket_medio: number;
  google_calendar_token: string | null;
  google_calendar_refresh_token: string | null;
  google_calendar_token_expires_at: string | null;
  created_at: string;
}

export interface LancamentoDiarioEvento {
  id: string;
  closer_id: string;
  google_event_id: string;
  event_summary: string | null;
  status: "reuniao_feita" | "no_show";
  data: string;
  lead_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface Sdr {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface LancamentoDiario {
  id: string;
  closer_id: string;
  data: string;
  reunioes_marcadas: number;
  reunioes_feitas: number;
  no_show: number;
  ganhos: number;
  mrr_dia: number;
  ltv: number;
  comissao_dia: number;
  obs: string | null;
  mes_referencia: string;
  created_at: string;
}

export interface Contrato {
  id: string;
  mes_referencia: string;
  closer_id: string;
  sdr_id: string;
  cliente_nome: string;
  origem_lead: string;
  valor_entrada: number;
  meses_contrato: number;
  mrr: number;
  valor_total_projeto: number;
  /**
   * Quando true (padrão), a entrada cobrada É o primeiro mês do contrato —
   * não é um valor adicional. Afeta o cálculo de valor_total_projeto:
   *   true  → valor_entrada + mrr × (meses_contrato - 1)
   *   false → valor_entrada + mrr × meses_contrato
   */
  entrada_e_primeiro_mes: boolean;
  /** 'rascunho' = criado manualmente sem venda.
   *  'pendente_aprovacao' = lead comprou, aguardando aprovação financeira.
   *  'ativo' = aprovado, entra nos cálculos de comissão e MRR.
   *  'cancelado' = venda cancelada. */
  status: "rascunho" | "pendente_aprovacao" | "ativo" | "cancelado";
  data_fechamento: string;
  obs: string | null;
  lead_id: string | null;
  created_at: string;

  // Campos de aprovação
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao_aprovacao: string | null;
  motivo_cancelamento: string | null;
  cliente_id: string | null;

  // Campos de pagamento
  sinal_valor: number;
  sinal_pago: boolean;
  sinal_data_pagamento: string | null;
  restante_valor: number;
  restante_data_prevista: string | null;
  restante_pago: boolean;
  restante_data_pagamento: string | null;

  // Campos de confirmação closer
  nome_empresa: string | null;
  cpf_cnpj_numero: string | null;
  pf_pj: string | null;
  forma_pagamento: string | null;
  modelo_contrato: string | null;
  quantidade_parcelas: number | null;
  data_pagamento_dia: number | null;
  enviar_contrato: boolean;
  contrato_enviado_em: string | null;
  preenchido_por: string | null;
  preenchido_em: string | null;

  /** Mensalidades variáveis: array de valores por mês */
  mensalidades_variaveis?: number[] | null;

  /** Tipo de pagamento: recorrente, variavel, avista */
  tipo_pagamento?: "recorrente" | "variavel" | "avista" | null;
  taxa_cartao?: number | null;
  taxa_repassada?: boolean | null;
}

export interface ConfigMensal {
  id: string;
  mes_referencia: string;
  leads_totais: number;
  investimento: number;
  funil_lead_para_qualificado: number | null;
  funil_lead_para_qualificado_manual: boolean;
  funil_qualificado_para_reuniao: number | null;
  funil_qualificado_para_reuniao_manual: boolean;
  funil_reuniao_para_proposta: number | null;
  funil_reuniao_para_proposta_manual: boolean;
  funil_proposta_para_fechamento: number | null;
  funil_proposta_para_fechamento_manual: boolean;
  meta_mrr: number | null;
  meta_mrr_manual: boolean;
  meta_contratos: number | null;
  meta_contratos_manual: boolean;
  noshow_rate: number | null;
  noshow_rate_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaMensal {
  id: string;
  mes_referencia: string;
  meta_entrada_valor: number;
  meta_faturamento_total: number;
  meta_contratos_fechados: number;
  meta_reunioes_agendadas: number;
  meta_reunioes_feitas: number;
  meta_taxa_no_show: number;
  leads_totais: number;
  valor_investido_anuncios: number;
  custo_por_reuniao: number;
  meses_padrao_contrato: number;
  created_at: string;
}

export interface MetaCloser {
  id: string;
  mes_referencia: string;
  closer_id: string;
  meta_contratos: number;
  meta_mrr: number;
  meta_ltv: number;
  meta_reunioes_feitas: number;
  meta_taxa_no_show: number;
  meta_sugerida_ia: number | null;
  meta_sugerida_justificativa: string | null;
}

export interface LancamentoSdr {
  id: string;
  sdr_id: string;
  data: string;
  mes_referencia: string;
  leads_recebidos: number;
  contatos_realizados: number;
  conexoes_feitas: number;
  reunioes_agendadas: number;
  no_show: number;
  follow_ups_feitos: number;
  obs: string | null;
}

export interface MetaSdr {
  id: string;
  sdr_id: string;
  mes_referencia: string;
  meta_contatos: number;
  meta_conexoes: number;
  meta_reunioes_agendadas: number;
  meta_taxa_no_show: number;
  meta_taxa_conexao: number;
  meta_taxa_agendamento: number;
}

export interface LeadCrm {
  id: string;
  ghl_contact_id: string | null;
  ghl_pipeline_id: string | null;
  ghl_opportunity_id: string | null;
  ad_id: string | null;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  closer_id: string | null;
  sdr_id: string | null;
  mes_referencia: string | null;
  etapa: "oportunidade" | "lead_qualificado" | "qualificado" | "reuniao_agendada" | "reuniao_feita" | "proposta_enviada" | "negociacao" | "follow_up" | "ligacao" | "no_show" | "remarketing" | "desqualificado" | "assinatura_contrato" | "comprou" | "desistiu" | "frio";
  data_reuniao_agendada: string | null;
  data_proposta_enviada: string | null;
  data_follow_up: string | null;
  data_assinatura: string | null;
  data_comprou: string | null;
  data_desistiu: string | null;
  motivo_desistencia: string | null;
  resumo_reuniao: string | null;
  pontos_positivos: string | null;
  objecoes: string | null;
  proximo_passo: string | null;
  contrato_id: string | null;
  canal_aquisicao: string | null;
  valor_entrada: number;
  mensalidade: number;
  fidelidade_meses: number;
  valor_total_projeto: number;
  data_venda: string | null;
  notion_page_id: string | null;
  agendamento: string | null;
  area_atuacao: string | null;
  instagram: string | null;
  site: string | null;
  link_proposta: string | null;
  faturamento: number;
  qualidade_lead: string | null;
  funil: string | null;
  origem_utm: string | null;
  primeiro_contato: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  preenchido_em: string | null;
  lead_id: string | null;
  /** Data em que a oportunidade foi criada no GHL (fonte de verdade para filtros de período) */
  ghl_created_at: string | null;
  /** Data de INSERT no Supabase (não usar para filtros de período) */
  created_at: string;
  updated_at: string;
  google_event_id: string | null;
  lead_avulso?: boolean;
  fonte_avulso?: string | null;
  ad_id_vinculado?: string | null;
  origem_tipo?: string | null;
  atribuicao_tier?: number | null;
  indicado_por_cliente_id?: string | null;

  /** Mensalidades variáveis: array de valores por mês. Ex: [1500, 2000, 1800] */
  mensalidades_variaveis?: number[] | null;

  // Campos de confirmação closer
  nome_empresa?: string | null;
  cpf_ou_cnpj?: string | null;
  cpf_cnpj_numero?: string | null;
  pf_pj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface LeadCrmHistorico {
  id: string;
  lead_id: string;
  etapa_anterior: string | null;
  etapa_nova: string;
  changed_at: string;
  obs: string | null;
}

export interface Recebimento {
  id: string;
  contrato_id: string | null;
  closer_id: string | null;
  cliente_nome: string;
  data_prevista: string;
  data_recebida: string | null;
  valor: number;
  tipo: "entrada" | "mensalidade" | "parcela";
  status: "pendente" | "recebido" | "atrasado";
  mes_referencia: string;
  obs: string | null;
  created_at: string;
}

export interface Alerta {
  id: string;
  tipo: string;
  severidade: "info" | "atencao" | "critico";
  titulo: string;
  descricao: string | null;
  closer_id: string | null;
  resolvido: boolean;
  criado_em: string;
  resolvido_em: string | null;
}

export interface ReuniaoSdr {
  id: string;
  sdr_id: string;
  closer_id: string;
  lead_nome: string;
  data_reuniao: string;
  mes_referencia: string;
  status: "agendada" | "feita" | "no_show" | "reagendada" | "cancelada";
  contrato_id: string | null;
  obs: string | null;
  created_at: string;
}

// ============ TRÁFEGO PAGO ============

export interface AdsMetadata {
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  objetivo: string | null;
  status: string;
  /** Creative fields — optional, populated when DB columns exist */
  thumbnail_url?: string | null;
  image_url?: string | null;
  ad_body?: string | null;
  ad_title?: string | null;
  link_url?: string | null;
  call_to_action_type?: string | null;
  updated_at: string;
}

export interface AdsPerformance {
  id: string;
  ad_id: string;
  data_ref: string;
  impressoes: number;
  cliques: number;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpc: number;
  frequencia: number;
  created_at: string;
}

export interface LeadAdsAttribution {
  id: string;
  lead_id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  nome_lead: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
  hora_chegada: number;
  dia_semana: number;
  estagio_crm: string;
  estagio_atualizado_em: string;
  receita_gerada: number;
  gestor_id: string | null;
}

export interface LeadStageHistory {
  id: string;
  lead_id: string;
  estagio_anterior: string | null;
  estagio_novo: string;
  alterado_em: string;
}

// ============ TRÁFEGO EXPANDIDO ============

export interface TrafegoRegraOtimizacao {
  id: string;
  nome: string;
  metrica: "cpl" | "ctr" | "frequencia" | "cpc" | "roas" | "leads_dia" | "spend_dia";
  operador: ">=" | "<=" | ">" | "<" | "=";
  threshold: number;
  acao_sugerida: "pausar_anuncio" | "pausar_conjunto" | "pausar_campanha" | "reduzir_orcamento" | "trocar_criativo" | "revisar_copy" | "revisar_publico";
  acao_automatica: boolean;
  prioridade: number;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
}

export interface TrafegoRegraHistorico {
  id: string;
  regra_id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  cliente_id: string | null;
  acao: "disparada" | "aplicada" | "ignorada" | "falsa_positiva";
  valor_metrica_no_momento: number;
  aplicada_por: string | null;
  observacao: string | null;
  criado_em: string;
}

export interface TrafegoCriativo {
  id: string;
  ad_id: string | null;
  cliente_id: string;
  nome: string;
  tipo: "video" | "imagem" | "roteiro";
  arquivo_url: string | null;
  copy_texto: string | null;
  roteiro_texto: string | null;
  transcricao_status: "pendente" | "processando" | "concluido" | "erro" | "manual";
  transcricao_texto: string | null;
  analise_status: "pendente" | "processando" | "concluido" | "erro";
  analise_resultado: {
    pontos_fortes: string[];
    pontos_fracos: string[];
    score: number;
    gatilhos_identificados: string[];
    publico_provavel: string;
    nicho_juridico: string;
    sugestoes_copy: {
      versao: string;
      headline: string;
      copy_completo: string;
      justificativa: string;
      baseado_em: string;
    }[];
    alerta_compliance: string | null;
  } | null;
  score_final: number | null;
  status_veiculacao: "ativo" | "pausado" | "fadigado" | "arquivado";
  data_inicio_veiculacao: string | null;
  data_fim_veiculacao: string | null;
  nicho: string | null;
  deleted_at: string | null;
  criado_em: string;
}

export interface TrafegoCriativoMetricas {
  id: string;
  criativo_id: string;
  mes_referencia: string;
  cpl: number | null;
  ctr: number | null;
  spend: number | null;
  leads: number | null;
  impressoes: number | null;
  frequencia: number | null;
  score_periodo: number | null;
  fase_ciclo_vida: "aquecimento" | "pico" | "estavel" | "fadiga" | "encerrado" | null;
}

export interface TrafegoAnomalia {
  id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  cliente_id: string | null;
  tipo: "gasto_zerado" | "cpl_dobrou" | "leads_zerados" | "spend_esgotando" | "spend_sobrando" | "performance_queda_brusca";
  valor_anterior: number | null;
  valor_atual: number | null;
  causa_provavel: string | null;
  resolvida: boolean;
  resolvida_em: string | null;
  criado_em: string;
}

export interface TrafegoPerformanceTemporal {
  id: string;
  cliente_id: string;
  dia_semana: number;
  hora: number;
  mes_referencia: string;
  total_leads: number;
  cpl_medio: number | null;
  taxa_qualificacao: number | null;
  total_spend: number | null;
  calculado_em: string;
}

// ============ PROJEÇÕES ============

export interface ProjecaoCenario {
  id: string;
  mes_referencia: string;
  nome: "base" | "otimista" | "pessimista" | "simulacao";
  orcamento_meta: number | null;
  noshow_rate: number | null;
  taxa_qualificacao: number | null;
  taxa_reuniao: number | null;
  taxa_fechamento: number | null;
  closers_ativos: number | null;
  leads_projetados: number | null;
  qualificados_projetados: number | null;
  reunioes_projetadas: number | null;
  propostas_projetadas: number | null;
  contratos_projetados: number | null;
  mrr_projetado: number | null;
  investimento_projetado: number | null;
  cac_projetado: number | null;
  is_simulacao: boolean;
  criado_em: string;
}

export interface ProjecaoHistoricoAcuracia {
  id: string;
  mes_referencia: string;
  mrr_projetado: number | null;
  mrr_realizado: number | null;
  contratos_projetados: number | null;
  contratos_realizados: number | null;
  leads_projetados: number | null;
  leads_realizados: number | null;
  acuracia_mrr: number | null;
  acuracia_contratos: number | null;
  acuracia_leads: number | null;
  acuracia_media: number | null;
  calculado_em: string;
}

export interface ProjecaoAlerta {
  id: string;
  mes_referencia: string;
  tipo: "meta_inalcancavel" | "gargalo_funil" | "ritmo_insuficiente";
  mensagem: string | null;
  deficit: number | null;
  acoes_sugeridas: string[] | null;
  visualizado: boolean;
  criado_em: string;
}

// ============ CLIENTES EXPANDIDO ============

export interface ClienteStatusHistorico {
  id: string;
  cliente_id: string;
  status_anterior: string | null;
  status_novo: string;
  alterado_por: string | null;
  motivo: string | null;
  criado_em: string;
}

export interface ChurnConsistenciaLog {
  id: string;
  mes_referencia: string;
  total_ativos_entrada: number | null;
  total_ativos_churn: number | null;
  divergencia: number | null;
  clientes_divergentes: Record<string, string[]> | null;
  status: "ok" | "divergencia_detectada";
  resolvido: boolean;
  criado_em: string;
}

// ============ FINANCEIRO EXPANDIDO ============

export interface AsaasPagamento {
  id: string;
  asaas_id: string | null;
  cliente_id: string | null;
  contrato_id: string | null;
  descricao: string;
  valor: number;
  status: "pending" | "received" | "confirmed" | "overdue" | "refunded";
  data_vencimento: string;
  data_pagamento: string | null;
  tipo: "boleto" | "pix" | "credit_card" | "outros";
  match_status: "pendente" | "conciliado_auto" | "conciliado_manual" | "sem_match";
  match_tentativas: number;
  aprovacao_criacao_status: "aguardando" | "aprovado" | "reprovado" | null;
  aprovacao_criacao_por: string | null;
  aprovacao_criacao_em: string | null;
  aprovacao_recebimento_status: "aguardando" | "aprovado" | "reprovado" | null;
  aprovacao_recebimento_por: string | null;
  aprovacao_recebimento_em: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export interface AsaasAuditoria {
  id: string;
  pagamento_id: string;
  acao: "criacao_solicitada" | "criacao_aprovada" | "criacao_reprovada"
  | "recebimento_solicitado" | "recebimento_aprovado" | "recebimento_reprovado"
  | "conciliacao_auto" | "conciliacao_manual" | "sem_match";
  executado_por: string | null;
  observacao: string | null;
  ip_sessao: string | null;
  criado_em: string;
  deleted_at: string | null;
}

export interface FinanceiroFluxoCaixa {
  id: string;
  mes_referencia: string;
  cenario: "otimista" | "realista" | "pessimista";
  receita_projetada: number;
  custos_projetados: number;
  resultado_projetado: number;
  churn_impacto: number;
  detalhamento: Record<string, unknown>;
  calculado_em: string;
  deleted_at: string | null;
}

export interface FinanceiroMargemCliente {
  id: string;
  cliente_id: string;
  mes_referencia: string;
  receita: number;
  custo_midia: number;
  custo_gestor: number;
  margem_bruta: number;
  margem_liquida: number;
  margem_pct: number;
  calculado_em: string;
  deleted_at: string | null;
}

export interface FinanceiroExportacao {
  id: string;
  mes_referencia: string;
  tipo: "csv" | "pdf";
  gerado_por: string | null;
  url: string | null;
  criado_em: string;
  deleted_at: string | null;
}
