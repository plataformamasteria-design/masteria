export interface ConfirmarVendaForm {
  // Seção 1 — Dados do cliente
  nome: string;
  whatsapp: string;
  email: string;
  instagram: string;
  nome_empresa: string;
  pf_pj: "PF" | "PJ" | "";
  tipo_documento: "CPF" | "CNPJ" | "";
  cpf_cnpj_numero: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Seção 2 — Dados do contrato
  mrr: number;
  valor_entrada: number;
  entrada_e_primeiro_mes: boolean;
  valor_total_projeto: number;
  meses_contrato: number | "";
  forma_pagamento: string;
  quantidade_parcelas: number;
  data_pagamento_dia: number | "";
  modelo_contrato: string;
  enviar_contrato: boolean;

  // Seção 3 — Pagamento inicial
  sinal_valor: number;
  sinal_pago: boolean;
  sinal_data_pagamento: string;
  restante_valor: number;
  restante_pago: boolean;
  restante_data_prevista: string;
  restante_data_pagamento: string;

  // Seção 4 — Origem
  origem: string;
  ad_id: string;
  indicado_por: string;
}

export const INITIAL_FORM: ConfirmarVendaForm = {
  nome: "",
  whatsapp: "",
  email: "",
  instagram: "",
  nome_empresa: "",
  pf_pj: "",
  tipo_documento: "",
  cpf_cnpj_numero: "",
  cep: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  mrr: 0,
  valor_entrada: 0,
  entrada_e_primeiro_mes: true,
  valor_total_projeto: 0,
  meses_contrato: "",
  forma_pagamento: "",
  quantidade_parcelas: 1,
  data_pagamento_dia: "",
  modelo_contrato: "",
  enviar_contrato: false,
  sinal_valor: 0,
  sinal_pago: false,
  sinal_data_pagamento: "",
  restante_valor: 0,
  restante_pago: false,
  restante_data_prevista: "",
  restante_data_pagamento: "",
  origem: "",
  ad_id: "",
  indicado_por: "",
};

/** Fallback estático — o sistema prioriza origens_lead do Supabase via useOrigens() */
export const ORIGENS = [
  "Tráfego Pago",
  "Indicação",
  "Social Selling",
  "Sessão Estratégica",
  "Webinar",
  "Orgânico",
  "WhatsApp direto",
  "Instagram",
  "Workshop",
] as const;

export const MODELOS_CONTRATO = [
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export const FIDELIDADES = [
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
  { value: 18, label: "18 meses" },
  { value: 24, label: "24 meses" },
  { value: 0, label: "Sem fidelidade" },
] as const;

export const FORMAS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
] as const;

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
