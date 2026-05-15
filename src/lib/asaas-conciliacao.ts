/**
 * Conciliação automática Asaas → contrato/cliente.
 * Match por descrição normalizada (lowercase, sem acentos).
 * Chamado após: sync de pagamentos e aprovação de recebimento.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

function normalizar(texto: string): string {
  if (!texto) return "";
  let s = texto.toLowerCase();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // remover sufixos comuns
  s = s.replace(/\b(ltda|me|eireli|dr|dra|advocacia|clinica|consultorio)\b/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export async function conciliarPagamento(pagamentoId: string): Promise<{
  success: boolean;
  match_status: string;
  cliente_id?: string;
  contrato_id?: string;
}> {
  // 1. Buscar pagamento
  const { data: pag } = await supabase
    .from("asaas_pagamentos")
    .select("id, descricao, match_status, match_tentativas, cliente_id")
    .eq("id", pagamentoId)
    .is("deleted_at", null)
    .single();

  if (!pag) return { success: false, match_status: "pendente" };
  if (pag.match_status !== "pendente") {
    return { success: true, match_status: pag.match_status, cliente_id: pag.cliente_id };
  }

  const descNorm = normalizar(pag.descricao || "");
  if (!descNorm) {
    await incrementarTentativa(pag.id, pag.match_tentativas);
    return { success: false, match_status: "pendente" };
  }

  // 2. Buscar clientes para match (fonte principal: clientes_receita)
  const { data: entradas } = await supabase
    .from("clientes_receita")
    .select("id, nome, cliente_id")
    .in("status_financeiro", ["ativo", "pausado"]);

  let matchCliente: { id: string; nome: string; contrato_id: string | null } | null = null;

  for (const e of entradas || []) {
    const nomeNorm = normalizar(e.nome);
    if (nomeNorm && descNorm.includes(nomeNorm)) {
      matchCliente = { id: e.cliente_id || e.id, nome: e.nome, contrato_id: null };
      break;
    }
    if (nomeNorm && nomeNorm.includes(descNorm)) {
      matchCliente = { id: e.cliente_id || e.id, nome: e.nome, contrato_id: null };
      break;
    }
  }

  if (matchCliente) {
    // Match encontrado
    await supabase
      .from("asaas_pagamentos")
      .update({
        cliente_id: matchCliente.id,
        contrato_id: matchCliente.contrato_id,
        match_status: "conciliado_auto",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pag.id);

    await supabase.from("asaas_auditoria").insert({
      pagamento_id: pag.id,
      acao: "conciliacao_auto",
      observacao: `Match automático: ${matchCliente.nome}`,
    });

    return {
      success: true,
      match_status: "conciliado_auto",
      cliente_id: matchCliente.id,
      contrato_id: matchCliente.contrato_id || undefined,
    };
  }

  // 3. Sem match — incrementar tentativas
  const tentativas = (pag.match_tentativas || 0) + 1;
  if (tentativas >= 3) {
    await supabase
      .from("asaas_pagamentos")
      .update({
        match_status: "sem_match",
        match_tentativas: tentativas,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pag.id);

    await supabase.from("asaas_auditoria").insert({
      pagamento_id: pag.id,
      acao: "sem_match",
      observacao: `Sem match após ${tentativas} tentativas`,
    });

    return { success: false, match_status: "sem_match" };
  }

  await incrementarTentativa(pag.id, tentativas);
  return { success: false, match_status: "pendente" };
}

async function incrementarTentativa(pagId: string, tentativas: number) {
  await supabase
    .from("asaas_pagamentos")
    .update({
      match_tentativas: tentativas,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", pagId);
}

/** Concilia todos os pagamentos pendentes */
export async function conciliarTodosPendentes(): Promise<number> {
  const { data: pendentes } = await supabase
    .from("asaas_pagamentos")
    .select("id")
    .eq("match_status", "pendente")
    .is("deleted_at", null);

  let conciliados = 0;
  for (const p of pendentes || []) {
    const result = await conciliarPagamento(p.id);
    if (result.match_status === "conciliado_auto") conciliados++;
  }
  return conciliados;
}
