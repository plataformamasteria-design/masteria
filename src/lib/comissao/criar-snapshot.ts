/**
 * criar-snapshot.ts — Persiste snapshot imutável de comissão ao fechar mês.
 *
 * Usa calcularComissao() da canônica para gerar valores, depois grava
 * em comissoes_snapshots. Uma vez gravado, snapshot NUNCA é recalculado.
 *
 * P96 — 2026-05-04
 */

import { createClient } from "@supabase/supabase-js";
import { calcularComissao, ComissaoColaborador } from "../comissao-canonica";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export interface SnapshotResult {
  success: boolean;
  total: number;
  elegiveis: number;
  valor_total: number;
  snapshots: Array<{
    employee_id: string;
    nome: string;
    funcao: string;
    comissao: number;
  }>;
}

/**
 * Cria snapshot imutável de comissão para um mês.
 * Idempotente: se já existe snapshot pro mês, ignora (não sobrescreve).
 */
export async function criarSnapshotComissaoMes(
  mesReferencia: string,
  fechadoPor: { id: string; nome: string }
): Promise<SnapshotResult> {
  // 1. Verificar se já existe snapshot para este mês
  const { count } = await supabase
    .from("comissoes_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("mes_referencia", mesReferencia)
    .is("deleted_at", null);

  if (count && count > 0) {
    // Já existe — retornar dados existentes sem sobrescrever
    const { data: existing } = await supabase
      .from("comissoes_snapshots")
      .select("employee_id, colaborador_nome, colaborador_funcao, comissao_calculada")
      .eq("mes_referencia", mesReferencia)
      .is("deleted_at", null);

    return {
      success: true,
      total: (existing || []).length,
      elegiveis: (existing || []).filter((s) => Number(s.comissao_calculada) > 0).length,
      valor_total: (existing || []).reduce((sum, s) => sum + Number(s.comissao_calculada), 0),
      snapshots: (existing || []).map((s) => ({
        employee_id: s.employee_id,
        nome: s.colaborador_nome,
        funcao: s.colaborador_funcao,
        comissao: Number(s.comissao_calculada),
      })),
    };
  }

  // 2. Calcular comissão via canônica (fonte de verdade)
  const resultado = await calcularComissao({ mes_referencia: mesReferencia });

  // 3. Montar rows para insert
  const rows = resultado.colaboradores.map((colab: ComissaoColaborador) => ({
    mes_referencia: mesReferencia,
    employee_id: colab.employee_id,
    colaborador_nome: colab.nome,
    colaborador_cargo: colab.fonte?.split(" —")[0] || colab.funcao,
    colaborador_funcao: colab.funcao,
    colaborador_recebe_comissao: colab.recebe_comissao,
    motivo_zerado: colab.motivo_zerado || null,
    comissao_calculada: colab.comissao_total,
    comissao_aprovada: colab.comissao_total, // default = calculado
    fechado_por: fechadoPor.id,
    fechado_por_nome: fechadoPor.nome,
    fonte_calculo: "comissao-canonica.ts",
    versao_canonica: "v1.3 P63+P87",
    payload_calculo: colab as unknown as Record<string, unknown>,
  }));

  if (rows.length === 0) {
    return { success: true, total: 0, elegiveis: 0, valor_total: 0, snapshots: [] };
  }

  // 4. Insert em batch (UNIQUE constraint garante idempotência)
  const { error } = await supabase
    .from("comissoes_snapshots")
    .insert(rows);

  if (error) throw new Error(`Erro ao criar snapshot: ${error.message}`);

  return {
    success: true,
    total: rows.length,
    elegiveis: rows.filter((r) => r.comissao_calculada > 0).length,
    valor_total: rows.reduce((sum, r) => sum + r.comissao_calculada, 0),
    snapshots: rows.map((r) => ({
      employee_id: r.employee_id,
      nome: r.colaborador_nome,
      funcao: r.colaborador_funcao,
      comissao: r.comissao_calculada,
    })),
  };
}

/**
 * Lê snapshot imutável de um mês. Retorna null se não existe.
 */
export async function lerSnapshotMes(mesReferencia: string) {
  const { data, error } = await supabase
    .from("comissoes_snapshots")
    .select("*")
    .eq("mes_referencia", mesReferencia)
    .is("deleted_at", null)
    .order("comissao_calculada", { ascending: false });

  if (error) throw new Error(`Erro ao ler snapshot: ${error.message}`);
  return data && data.length > 0 ? data : null;
}

/**
 * Lista meses que têm snapshot.
 */
export async function listarMesesComSnapshot(): Promise<string[]> {
  const { data } = await supabase
    .from("comissoes_snapshots")
    .select("mes_referencia")
    .is("deleted_at", null)
    .order("mes_referencia", { ascending: false });

  if (!data) return [];
  const set = new Set(data.map((r) => r.mes_referencia));
  return Array.from(set);
}
