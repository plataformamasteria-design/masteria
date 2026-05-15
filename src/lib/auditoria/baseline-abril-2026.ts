/**
 * BASELINE IMUTÁVEL — Lançamentos Abril 2026
 * Fonte: Planilha Lucas (Ground Truth)
 *
 * Schema da tabela `despesas` no Supabase:
 *   id (uuid), data_lancamento (date), descricao (text), conta (text),
 *   categoria (text), valor (numeric), tipo (text), parcela_atual (int),
 *   parcelas_total (int), mes_referencia (text), deleted_at (timestamptz),
 *   created_at (timestamptz)
 *
 * Total registros: 68
 * Total geral: R$ 140.796,83
 */

export interface BaselineItem {
  data: string;
  descricao: string;
  metodo_pagamento: string | null;
  categoria: string;
  valor: number;
}

export const BASELINE_LANCAMENTOS_ABRIL_2026 = [
  { data: "2026-04-06", descricao: "nubank LU", metodo_pagamento: null, categoria: "Ads", valor: 2684.62 },
  { data: "2026-04-06", descricao: "Lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 313.00 },
  { data: "2026-04-06", descricao: "lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 2981.80 },
  { data: "2026-04-06", descricao: "Lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 4989.64 },
  { data: "2026-04-06", descricao: "aluguel 06", metodo_pagamento: null, categoria: "Aluguel", valor: 2800.00 },
  { data: "2026-04-06", descricao: "aluguel 05", metodo_pagamento: null, categoria: "Aluguel", valor: 4500.00 },
  { data: "2026-04-06", descricao: "cbm", metodo_pagamento: null, categoria: "Investimentos", valor: 5000.00 },
  { data: "2026-04-01", descricao: "vitor mentoria", metodo_pagamento: "Asaas", categoria: "Mentoria", valor: 5000.00 },
  { data: "2026-04-01", descricao: "edicao de video", metodo_pagamento: null, categoria: "Audiovisual", valor: 280.00 },
  { data: "2026-04-01", descricao: "cartao mae", metodo_pagamento: "Asaas", categoria: "Obra", valor: 2578.00 },
  { data: "2026-04-01", descricao: "Mariana fixo", metodo_pagamento: "Asaas", categoria: "Equipe Comercial", valor: 2000.00 },
  { data: "2026-04-01", descricao: "roger", metodo_pagamento: null, categoria: "Equipe Comercial", valor: 2000.00 },
  { data: "2026-04-01", descricao: "clara", metodo_pagamento: null, categoria: "Equipe Adm", valor: 2500.00 },
  { data: "2026-04-01", descricao: "flaviuo", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 4000.00 },
  { data: "2026-04-01", descricao: "yago", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2000.00 },
  { data: "2026-04-01", descricao: "eemerson", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2500.00 },
  { data: "2026-04-01", descricao: "bruno", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2500.00 },
  { data: "2026-04-01", descricao: "nando", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2500.00 },
  { data: "2026-04-01", descricao: "heber", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2000.00 },
  { data: "2026-04-01", descricao: "deivid", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 2000.00 },
  { data: "2026-04-01", descricao: "gabriel edicao", metodo_pagamento: null, categoria: "Audiovisual", valor: 2417.00 },
  { data: "2026-04-01", descricao: "eduardo", metodo_pagamento: null, categoria: "Equipe Operacional", valor: 1267.00 },
  { data: "2026-04-01", descricao: "davi", metodo_pagamento: null, categoria: "Equipe Comercial", valor: 2000.00 },
  { data: "2026-04-01", descricao: "limpeza", metodo_pagamento: null, categoria: "Limpeza", valor: 440.00 },
  { data: "2026-04-08", descricao: "Comissao mari", metodo_pagamento: null, categoria: "Comissoes", valor: 3279.00 },
  { data: "2026-04-08", descricao: "comissao roger", metodo_pagamento: null, categoria: "Comissoes", valor: 1980.00 },
  { data: "2026-04-08", descricao: "lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 100.00 },
  { data: "2026-04-08", descricao: "comissao davi", metodo_pagamento: null, categoria: "Comissoes", valor: 432.00 },
  { data: "2026-04-08", descricao: "michael", metodo_pagamento: null, categoria: "Equipe de MKT", valor: 1000.00 },
  { data: "2026-04-08", descricao: "feijoada", metodo_pagamento: null, categoria: "Comemoracao", valor: 100.00 },
  { data: "2026-04-08", descricao: "lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 3015.00 },
  { data: "2026-04-08", descricao: "notrev", metodo_pagamento: null, categoria: "Ferramentas/Softwares", valor: 90.00 },
  { data: "2026-04-08", descricao: "ads", metodo_pagamento: null, categoria: "Ads", valor: 252.06 },
  { data: "2026-04-08", descricao: "software", metodo_pagamento: null, categoria: "Ferramentas/Softwares", valor: 1261.00 },
  { data: "2026-04-08", descricao: "GHL 50%", metodo_pagamento: null, categoria: "Investimentos", valor: 1347.00 },
  { data: "2026-04-08", descricao: "iof", metodo_pagamento: null, categoria: "Imposto", valor: 44.00 },
  { data: "2026-04-08", descricao: "outros", metodo_pagamento: null, categoria: "Outros", valor: 429.41 },
  { data: "2026-04-08", descricao: "Lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 4013.00 },
  { data: "2026-04-08", descricao: "pizza", metodo_pagamento: null, categoria: "Mercado", valor: 120.00 },
  { data: "2026-04-10", descricao: "99", metodo_pagamento: null, categoria: "Outros", valor: 15.00 },
  { data: "2026-04-10", descricao: "Api wpp", metodo_pagamento: null, categoria: "Ferramentas/Softwares", valor: 90.00 },
  { data: "2026-04-13", descricao: "lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 3000.00 },
  { data: "2026-04-14", descricao: "feijoada", metodo_pagamento: null, categoria: "Comemoracao", valor: 100.00 },
  { data: "2026-04-15", descricao: "equipamento", metodo_pagamento: null, categoria: "Equipamento", valor: 500.00 },
  { data: "2026-04-15", descricao: "vinilico", metodo_pagamento: null, categoria: "Obra", valor: 798.00 },
  { data: "2026-04-15", descricao: "comissao fernando", metodo_pagamento: null, categoria: "Comissoes", valor: 500.00 },
  { data: "2026-04-16", descricao: "acomp vitor", metodo_pagamento: null, categoria: "Mentoria", valor: 5000.00 },
  { data: "2026-04-20", descricao: "equipamento", metodo_pagamento: null, categoria: "Equipamento", valor: 500.00 },
  { data: "2026-04-20", descricao: "zapsign e gpt", metodo_pagamento: null, categoria: "Ferramentas/Softwares", valor: 200.00 },
  { data: "2026-04-20", descricao: "wellhub", metodo_pagamento: null, categoria: "Investimentos", valor: 390.00 },
  { data: "2026-04-20", descricao: "hostinger", metodo_pagamento: null, categoria: "Ferramentas/Softwares", valor: 87.00 },
  { data: "2026-04-20", descricao: "macbook", metodo_pagamento: null, categoria: "Equipamento", valor: 777.00 },
  { data: "2026-04-20", descricao: "ADS", metodo_pagamento: null, categoria: "Ads", valor: 19853.00 },
  { data: "2026-04-20", descricao: "Aluguel 1407", metodo_pagamento: null, categoria: "Aluguel", valor: 2500.00 },
  { data: "2026-04-20", descricao: "lucas", metodo_pagamento: null, categoria: "Prolabore", valor: 215.00 },
  { data: "2026-04-20", descricao: "Mercado pago", metodo_pagamento: null, categoria: "Equipamento", valor: 1213.00 },
  { data: "2026-04-20", descricao: "mac mini", metodo_pagamento: null, categoria: "Equipamento", valor: 2000.00 },
  { data: "2026-04-22", descricao: "Das", metodo_pagamento: null, categoria: "Imposto", valor: 6758.00 },
  { data: "2026-04-23", descricao: "limpeza 2 semanas", metodo_pagamento: null, categoria: "Limpeza", valor: 440.00 },
  { data: "2026-04-23", descricao: "refri", metodo_pagamento: null, categoria: "Mercado", valor: 10.00 },
  { data: "2026-04-23", descricao: "probo", metodo_pagamento: null, categoria: "Prolabore", valor: 7000.00 },
  { data: "2026-04-25", descricao: "energia 1406", metodo_pagamento: null, categoria: "Energia", valor: 1896.00 },
  { data: "2026-04-25", descricao: "low tickt", metodo_pagamento: null, categoria: "Mentoria", valor: 48.00 },
  { data: "2026-04-27", descricao: "Chiquiti recisao", metodo_pagamento: null, categoria: "Prejuizo", valor: 4717.43 },
  { data: "2026-04-27", descricao: "outros", metodo_pagamento: null, categoria: "Outros", valor: 350.00 },
  { data: "2026-04-27", descricao: "cafe", metodo_pagamento: null, categoria: "Mercado", valor: 192.87 },
  { data: "2026-04-27", descricao: "rute e everton rescisao", metodo_pagamento: null, categoria: "Prejuizo", valor: 2800.00 },
  { data: "2026-04-27", descricao: "internet", metodo_pagamento: null, categoria: "Internet", valor: 133.00 },
] as const satisfies readonly BaselineItem[];

export const BASELINE_TOTAL = 140796.83;
export const BASELINE_COUNT = 68;
