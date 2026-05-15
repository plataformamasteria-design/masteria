import { z } from "zod";

const mesRefRegex = /^\d{4}-\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ── Tier 1 (P98) ──

export const atribuicaoManualSchema = z.object({
  contrato_id: z.string().uuid(),
  meta_campaign_id: z.string().min(1),
});

export const comissaoPatchSchema = z.object({
  id: z.string().uuid(),
  valor_aprovado: z.number().min(0).max(1_000_000).optional(),
  observacao: z.string().max(2000).optional(),
  entra_em_cac: z.boolean().optional(),
});

export const comissaoAprovarSchema = z.object({
  id: z.string().uuid(),
});

// ── Tier 2 (P100) ──

export const comissaoExtraSchema = z.object({
  mes: z.string().regex(mesRefRegex, "Formato YYYY-MM"),
  colaborador_nome: z.string().min(1).max(200),
  valor: z.number().min(0).max(1_000_000),
  observacao: z.string().max(2000).optional(),
  entra_em_cac: z.boolean().optional(),
});

export const comissaoFecharMesSchema = z.object({
  mes: z.string().regex(mesRefRegex, "Formato YYYY-MM"),
});

export const comissaoReabrirMesSchema = z.object({
  mes: z.string().regex(mesRefRegex, "Formato YYYY-MM"),
  observacao: z.string().max(2000).optional(),
});

export const custoFixoPostSchema = z.object({
  tabela: z.enum(["custos_fixos", "parcelamentos", "folha_pagamento"]),
  nome: z.string().min(1).max(500).optional(),
  cargo: z.string().max(200).optional(),
  dia_pagamento: z.number().int().min(1).max(31).optional(),
  contato: z.string().max(200).optional(),
  descricao: z.string().min(1).max(500).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  valor_parcela: z.number().min(0).max(1_000_000).optional(),
  dia_vencimento: z.number().int().min(1).max(31).optional(),
  meio_pagamento: z.string().max(200).optional(),
  categoria: z.string().max(200).optional(),
  parcela_atual: z.number().int().min(0).optional(),
  parcelas_total: z.number().int().min(1).optional(),
  recorrencia_tipo: z.string().max(50).optional(),
  recorrencia_config: z.record(z.unknown()).optional(),
});

export const custoFixoPatchSchema = z.object({
  tabela: z.enum(["folha_pagamento", "custos_fixos", "parcelamentos"]),
  id: z.string().uuid(),
}).passthrough();

export const custoFixoPagamentoSchema = z.object({
  custo_fixo_id: z.string().uuid(),
  tipo: z.string().min(1).max(50),
  mes_referencia: z.string().regex(mesRefRegex, "Formato YYYY-MM"),
  nome: z.string().max(500).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  categoria: z.string().max(200).optional(),
});

export const entradaPagamentoSchema = z.object({
  cliente_id: z.string().uuid(),
  mes_referencia: z.string().min(1),
  valor_pago: z.number().min(0).max(1_000_000).optional(),
  dia_pagamento: z.number().int().min(1).max(31).optional(),
  status: z.string().max(50).optional(),
  justificativa: z.string().max(2000).optional(),
  mes_pagamento: z.string().optional(),
});

export const entradaAnteciparSchema = z.object({
  cliente_id: z.string().uuid(),
  valor_liquido: z.number().min(0).max(1_000_000),
  valor_bruto: z.number().min(0).max(1_000_000).optional(),
  data_antecipacao: z.string().regex(dateRegex, "Formato YYYY-MM-DD"),
  registrar_taxa: z.boolean().optional(),
});

export const entradaClienteSchema = z.object({
  nome: z.string().min(1).max(500),
  valor_mensal: z.number().min(0).max(1_000_000),
}).passthrough();

export const churnarClienteSchema = z.object({
  cliente_receita_id: z.string().uuid(),
  motivo: z.string().max(500).optional(),
  observacao: z.string().max(2000).optional(),
});

export const importarEntradasSchema = z.array(
  z.object({
    nome: z.string().min(1),
    plataforma: z.string(),
    valor_mensal: z.number().min(0).max(1_000_000),
    ltv_meses: z.number().nullable(),
    closer: z.string(),
    tipo_contrato: z.string(),
    dia_pagamento: z.number().int().min(1).max(31).nullable(),
    status: z.string(),
    mes_fechamento: z.string().nullable(),
    obs: z.string().nullable(),
    pagamentos: z.array(z.object({
      mes: z.number().int().min(1).max(12),
      valor: z.number().min(0),
      dia: z.number().int().min(1).max(31).nullable(),
      status: z.string(),
    })),
  })
).min(1).max(500);
