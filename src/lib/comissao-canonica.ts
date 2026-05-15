/**
 * comissao-canonica.ts — Funcao canonica de calculo de comissao.
 *
 * FASE 3 do Ticket 007. Coexiste com src/lib/comissao.ts (que sera
 * deprecado na FASE 5). Nenhum sistema legado e alterado aqui.
 *
 * Fontes de dados (todas read-only):
 * - employees: lista de colaboradores ativos (cargo, entity_id)
 * - closers / sdrs: entidades vinculadas via entity_id
 * - config_comissao: faixas de comissao (unica fonte de verdade)
 * - recebimentos_mensais: carteira (valor_pago x 10%)
 * - clientes_receita: excluir renovados/churned
 * - contratos: OTE (mai/26+), deteccao de renovacao
 * - metas_closers / metas_sdr: metas mensais
 * - leads_crm: comparecimentos SDR
 * - comissoes_mes_status: snapshot mensal
 * - comissoes_mensais: valores aprovados (quando mes fechado)
 *
 * Regras:
 * - Lucas (Diretor) NAO gera comissao
 * - Fernando (Gestor Pleno) NAO gera comissao
 * - Match por FK (closer_id, sdr_id), NUNCA ILIKE
 * - Faixas SEMPRE de config_comissao, NUNCA hardcoded
 * - Renovacao detectada via cliente_nome historico (mesma logica de
 *   /api/projecoes/aquisicao-resumo)
 * - Divisor=0 → null (nunca NaN/Infinity)
 * - Mes fechado → retorna snapshot imutavel
 */

import { createClient } from "@supabase/supabase-js";
import { isCargoComercial, motivoZerado } from "./comissao/cargos-comerciais";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

const CARTEIRA_PCT = 10;
const CLOSER_PADRAO = "Lucas";
const MES_INICIO_OTE = "2026-05";

// Etapas que contam como "comparecimento" para SDR
const ETAPAS_COMPARECIMENTO = [
  "reuniao_feita",
  "proposta_enviada",
  "negociacao",
  "contrato",
  "comprou",
  "assinatura_contrato",
];

// Cargos comerciais: centralizado em src/lib/comissao/cargos-comerciais.ts

// ─── Types ───────────────────────────────────────────────────

export interface ComissaoColaborador {
  id: string;
  employee_id: string;
  nome: string;
  funcao: "sdr" | "closer";
  recebe_comissao: boolean;
  motivo_zerado?: string;
  // Closer fields
  carteira_total_pago?: number;
  carteira_comissao?: number;
  carteira_clientes?: number;
  carteira_clientes_pagos?: number;
  ote_comissao?: number;
  ote_contratos_ativos?: number;
  ote_detalhes?: Array<{
    cliente: string;
    valor_pago: number;
    faixa_pct: number;
    comissao: number;
  }>;
  // SDR fields
  comparecimentos?: number;
  meta_reunioes?: number;
  valor_por_reuniao?: number;
  // Shared
  meta_pct: number | null;
  faixa_aplicada: { faixa_min: number; faixa_max: number | null; valor: number } | null;
  comissao_total: number;
  fonte: string;
  snapshot_aplicado: boolean;
}

export interface ComissaoResult {
  mes_referencia: string;
  colaboradores: ComissaoColaborador[];
  totais: {
    comissao_closers: number;
    comissao_sdrs: number;
    comissao_total: number;
    contratos_novos_total: number;
    renovacoes_total: number;
  };
  mes_fechado: boolean;
}

// ─── Faixa helpers ───────────────────────────────────────────

interface FaixaRow {
  id: string;
  tipo: string;
  faixa_min: number;
  faixa_max: number | null;
  valor: string;
  unidade: string;
  ativo: boolean;
}

function findFaixa(
  faixas: FaixaRow[],
  pctMeta: number
): { faixa_min: number; faixa_max: number | null; valor: number } | null {
  const sorted = faixas
    .filter((f) => f.ativo)
    .sort((a, b) => b.faixa_min - a.faixa_min);
  const f = sorted.find((f) => pctMeta >= f.faixa_min);
  if (!f) return null;
  return { faixa_min: f.faixa_min, faixa_max: f.faixa_max, valor: Number(f.valor) };
}

// ─── Renovation detection (reused from aquisicao-resumo) ────

async function getClientesAnterioresSet(mesReferencia: string): Promise<Set<string>> {
  const [y, m] = mesReferencia.split("-").map(Number);
  const firstDay = `${mesReferencia}-01`;
  const { data } = await supabase
    .from("contratos")
    .select("cliente_nome")
    .lt("data_fechamento", firstDay)
    .eq("status", "ativo");
  return new Set(
    (data || []).map((c: { cliente_nome: string | null }) =>
      (c.cliente_nome || "").toUpperCase().trim()
    )
  );
}

function isRenovacao(clienteNome: string, anterioresSet: Set<string>): boolean {
  const norm = (clienteNome || "").toUpperCase().trim();
  return norm !== "" && anterioresSet.has(norm);
}

// ─── Resolve closers.id → colaboradores_rh.id ─────────────

export async function getCloserRhId(closerId: string): Promise<string | null> {
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("entity_id", closerId)
    .maybeSingle();
  if (!emp) return null;
  const { data: rh } = await supabase
    .from("colaboradores_rh")
    .select("id")
    .eq("employee_id", emp.id)
    .maybeSingle();
  return rh?.id || null;
}

// ─── Carteira (closer, all months) ──────────────────────────

export async function getRecebimentosDoCloser(closerNome: string, mesDb: string, closerRhId?: string | null) {
  // Ticket 014: preferir closer_id (FK) quando disponivel
  if (closerRhId) {
    const filterParts = [`closer_id.eq.${closerRhId}`];
    if (closerNome === CLOSER_PADRAO) {
      filterParts.push(`closer.eq.${closerNome}`, `closer.is.null`);
    } else {
      filterParts.push(`closer.eq.${closerNome}`);
    }
    const { data } = await supabase
      .from("recebimentos_mensais")
      .select("id, cliente_nome, mrr_contrato, closer, closer_id, valor_pago, data_pagamento")
      .eq("mes_referencia", mesDb)
      .or(filterParts.join(","));

    if (!data || data.length === 0) return [];

    // Dedup
    const seen = new Set<string>();
    const deduped = [];
    for (const r of data) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        deduped.push(r);
        if (!r.closer_id && r.closer) {
          console.log(`[ticket-014-fallback] canonica closer text fallback: "${r.closer}" para ${r.cliente_nome}`);
        }
      }
    }
    return filterExcluidos(deduped);
  }

  // Fallback legado: match por nome
  const filter =
    closerNome === CLOSER_PADRAO
      ? `closer.eq.${closerNome},closer.is.null`
      : `closer.eq.${closerNome}`;
  const { data } = await supabase
    .from("recebimentos_mensais")
    .select("id, cliente_nome, mrr_contrato, closer, closer_id, valor_pago, data_pagamento")
    .eq("mes_referencia", mesDb)
    .or(filter);

  if (!data || data.length === 0) return [];
  return filterExcluidos(data);
}

async function filterExcluidos(data: { id: string; cliente_nome: string; [k: string]: unknown }[]) {
  const nomes = data.map((r) => r.cliente_nome?.trim()).filter(Boolean);
  if (nomes.length === 0) return data;
  const { data: excluidos } = await supabase
    .from("clientes_receita")
    .select("nome")
    .in("nome", nomes as string[])
    .or("renovado.eq.true,status.eq.churned");

  if (excluidos && excluidos.length > 0) {
    const excluirSet = new Set(
      excluidos.map((r) => r.nome?.trim().toUpperCase())
    );
    return data.filter(
      (r) => !excluirSet.has(r.cliente_nome?.trim().toUpperCase())
    );
  }
  return data;
}

// ─── OTE faixa travada por mes de fechamento ────────────────

async function getFaixaDoMes(
  closerId: string,
  mesFechamento: string,
  faixas: FaixaRow[]
): Promise<number> {
  const [{ data: meta }, { data: cts }] = await Promise.all([
    supabase
      .from("metas_closers")
      .select("meta_contratos")
      .eq("closer_id", closerId)
      .eq("mes_referencia", mesFechamento)
      .maybeSingle(),
    supabase
      .from("contratos")
      .select("id")
      .eq("closer_id", closerId)
      .eq("mes_referencia", mesFechamento)
      .neq("status", "rascunho")
      .neq("status", "cancelado"),
  ]);
  const metaContratos = Number(meta?.meta_contratos || 0);
  const realizado = (cts || []).length;
  const pct = metaContratos > 0 ? (realizado / metaContratos) * 100 : 0;
  const faixa = findFaixa(faixas, pct);
  return faixa?.valor || 0;
}

// ─── Main function ──────────────────────────────────────────

export async function calcularComissao(input: {
  mes_referencia: string;
  colaborador_id?: string;
  funcao?: "sdr" | "closer" | "all";
}): Promise<ComissaoResult> {
  const { mes_referencia, colaborador_id, funcao = "all" } = input;
  const mesDb = `${mes_referencia}-01`;

  // 1. Check if month is closed (snapshot)
  const { data: mesStatus } = await supabase
    .from("comissoes_mes_status")
    .select("status, snapshot_valores")
    .eq("mes_referencia", mes_referencia)
    .maybeSingle();

  const mesFechado = mesStatus?.status === "fechado";

  // If closed AND has snapshot, return approved values from comissoes_mensais
  if (mesFechado && mesStatus?.snapshot_valores) {
    return buildSnapshotResult(mes_referencia, colaborador_id, funcao);
  }

  // 2. List active employees with comissao-eligible cargos
  let empQuery = supabase
    .from("employees")
    .select("id, nome, cargo, entity_id, ativo, recebe_comissao")
    .eq("ativo", true);

  if (colaborador_id) {
    empQuery = empQuery.eq("id", colaborador_id);
  }

  const { data: employees } = await empQuery;

  // Regra oficial: cargo e primario, flag e override secundario.
  // Cargo comercial (SDR/Closer) + flag !== false → elegivel
  // Cargo nao-comercial → inelegivel independente da flag
  // Flag false explicita → inelegivel independente do cargo

  const allEmps = employees || [];

  // Inelegiveis: aparecem no resultado com comissao 0 e motivo
  const semComissao = allEmps.filter((e) => {
    const motivo = motivoZerado(e.cargo, e.recebe_comissao);
    return motivo !== undefined;
  });

  // Elegiveis: cargo comercial + flag !== false
  const allEmployees = allEmps.filter((e) => {
    const cargoComercial = isCargoComercial(e.cargo);
    if (!cargoComercial || e.recebe_comissao === false) return false;
    const cargoLower = (e.cargo || "").toLowerCase();
    // Filter by funcao param
    if (funcao === "closer" && !cargoLower.includes("closer")) return false;
    if (funcao === "sdr" && !["sdr", "social seller"].includes(cargoLower)) return false;
    return true;
  });

  // 3. Load faixas from config_comissao
  const { data: faixasData } = await supabase
    .from("config_comissao")
    .select("*")
    .eq("ativo", true)
    .order("faixa_min");
  const allFaixas = (faixasData || []) as FaixaRow[];
  const faixasCloser = allFaixas.filter((f) => f.tipo === "closer");
  const faixasSdr = allFaixas.filter((f) => f.tipo === "sdr_ss");

  // 4. Load renovation detection set
  const anterioresSet = await getClientesAnterioresSet(mes_referencia);

  // 5. Calculate per employee
  const colaboradores: ComissaoColaborador[] = [];
  let totalContratosNovos = 0;
  let totalRenovacoes = 0;

  for (const emp of allEmployees) {
    const cargoLower = (emp.cargo || "").toLowerCase();
    const isCloser = cargoLower.includes("closer");
    const entityId = emp.entity_id;

    if (!entityId) continue;

    if (isCloser) {
      const result = await calcularCloser(
        emp,
        entityId,
        mes_referencia,
        mesDb,
        faixasCloser,
        anterioresSet
      );
      totalContratosNovos += result.contratosNovos;
      totalRenovacoes += result.renovacoes;
      colaboradores.push(result.colab);
    } else {
      // SDR / Social Seller
      const result = await calcularSdr(emp, entityId, mes_referencia, faixasSdr);
      colaboradores.push(result);
    }
  }

  // Add ineligible employees (appear with 0, flagged with motivo)
  for (const emp of semComissao) {
    const cargoLower = (emp.cargo || "").toLowerCase();
    const fn: "closer" | "sdr" = cargoLower.includes("closer") ? "closer" : "sdr";
    const motivo = motivoZerado(emp.cargo, emp.recebe_comissao) || "cargo_nao_comercial";
    colaboradores.push({
      id: emp.entity_id || emp.id,
      employee_id: emp.id,
      nome: emp.nome,
      funcao: fn,
      recebe_comissao: false,
      motivo_zerado: motivo,
      meta_pct: null,
      faixa_aplicada: null,
      comissao_total: 0,
      fonte: `${emp.cargo} — sem comissao (${motivo})`,
      snapshot_aplicado: false,
    });
  }

  const comissaoClosers = colaboradores
    .filter((c) => c.funcao === "closer")
    .reduce((s, c) => s + c.comissao_total, 0);
  const comissaoSdrs = colaboradores
    .filter((c) => c.funcao === "sdr")
    .reduce((s, c) => s + c.comissao_total, 0);

  return {
    mes_referencia,
    colaboradores,
    totais: {
      comissao_closers: comissaoClosers,
      comissao_sdrs: comissaoSdrs,
      comissao_total: comissaoClosers + comissaoSdrs,
      contratos_novos_total: totalContratosNovos,
      renovacoes_total: totalRenovacoes,
    },
    mes_fechado: mesFechado,
  };
}

// ─── Closer calculation ─────────────────────────────────────

async function calcularCloser(
  emp: { id: string; nome: string; cargo: string; entity_id: string },
  closerId: string,
  mesRef: string,
  mesDb: string,
  faixas: FaixaRow[],
  anterioresSet: Set<string>
): Promise<{
  colab: ComissaoColaborador;
  contratosNovos: number;
  renovacoes: number;
}> {
  // Get closer name and RH id for recebimentos match
  const [{ data: closerData }, closerRhId] = await Promise.all([
    supabase.from("closers").select("nome").eq("id", closerId).single(),
    getCloserRhId(closerId),
  ]);
  const closerNome = closerData?.nome || emp.nome;

  // ── CARTEIRA (all months): 10% of valor_pago ──
  // Ticket 014: preferir closer_id quando disponivel, fallback pra closer (text)
  const recebimentos = await getRecebimentosDoCloser(closerNome, mesDb, closerRhId);
  const carteiraPago = recebimentos.reduce(
    (s, r) => s + Number(r.valor_pago || 0),
    0
  );
  const clientesPagos = recebimentos.filter((r) => r.data_pagamento).length;
  const comissaoCarteira = carteiraPago * (CARTEIRA_PCT / 100);

  // ── OTE (mai/26+): faixa travada no mes de fechamento ──
  let comissaoOte = 0;
  let contratosOteAtivos = 0;
  const oteDetalhes: ComissaoColaborador["ote_detalhes"] = [];

  if (mesRef >= MES_INICIO_OTE) {
    const { data: contratosNovos } = await supabase
      .from("contratos")
      .select(
        "id, cliente_nome, mrr, meses_contrato, data_fechamento, mes_referencia, status"
      )
      .eq("closer_id", closerId)
      .gte("mes_referencia", MES_INICIO_OTE)
      .eq("status", "ativo");

    const faixaCache: Record<string, number> = {};
    for (const ct of contratosNovos || []) {
      // Check vigencia
      const meses = ct.meses_contrato || 0;
      if (meses <= 0 || ct.status !== "ativo") continue;
      const [aF, mF] = (ct.data_fechamento || "").split("-").map(Number);
      const [aA, mA] = mesRef.split("-").map(Number);
      const decorridos = (aA - aF) * 12 + (mA - mF);
      if (decorridos < 0 || decorridos >= meses) continue;

      // Faixa travada no mes de fechamento
      const mesFech = ct.mes_referencia;
      if (faixaCache[mesFech] === undefined) {
        faixaCache[mesFech] = await getFaixaDoMes(closerId, mesFech, faixas);
      }
      const pctFaixa = faixaCache[mesFech];
      if (pctFaixa <= 0) continue;

      // Cruzar com recebimentos para valor_pago efetivo
      const nomeCliente = (ct.cliente_nome || "").trim().toUpperCase();
      const recCliente = recebimentos.find(
        (r) => (r.cliente_nome || "").trim().toUpperCase() === nomeCliente
      );
      const valorPagoMes = recCliente ? Number(recCliente.valor_pago || 0) : 0;
      if (valorPagoMes <= 0) continue;

      const comCt = valorPagoMes * (pctFaixa / 100);
      comissaoOte += comCt;
      contratosOteAtivos++;
      oteDetalhes!.push({
        cliente: ct.cliente_nome || "",
        valor_pago: valorPagoMes,
        faixa_pct: pctFaixa,
        comissao: comCt,
      });
    }
  }

  // ── Contratos do mes (contagem novos vs renovacoes) ──
  const { data: ctsMes } = await supabase
    .from("contratos")
    .select("id, cliente_nome, mrr")
    .eq("closer_id", closerId)
    .eq("mes_referencia", mesRef)
    .neq("status", "rascunho")
    .neq("status", "cancelado");

  let contratosNovosCount = 0;
  let renovacoesCount = 0;
  for (const ct of ctsMes || []) {
    if (isRenovacao(ct.cliente_nome, anterioresSet)) {
      renovacoesCount++;
    } else {
      contratosNovosCount++;
    }
  }

  // Meta
  const { data: metaData } = await supabase
    .from("metas_closers")
    .select("meta_contratos")
    .eq("closer_id", closerId)
    .eq("mes_referencia", mesRef)
    .maybeSingle();
  const metaContratos = Number(metaData?.meta_contratos || 0);
  const realizado = (ctsMes || []).length;
  const pctMeta = metaContratos > 0 ? (realizado / metaContratos) * 100 : null;

  const faixaAtual = pctMeta !== null ? findFaixa(faixas, pctMeta) : null;
  const comissaoTotal = comissaoCarteira + comissaoOte;

  return {
    colab: {
      id: closerId,
      employee_id: emp.id,
      nome: emp.nome,
      funcao: "closer",
      recebe_comissao: true,
      carteira_total_pago: carteiraPago,
      carteira_comissao: comissaoCarteira,
      carteira_clientes: recebimentos.length,
      carteira_clientes_pagos: clientesPagos,
      ote_comissao: comissaoOte,
      ote_contratos_ativos: contratosOteAtivos,
      ote_detalhes: oteDetalhes,
      meta_pct: pctMeta,
      faixa_aplicada: faixaAtual,
      comissao_total: comissaoTotal,
      fonte: "carteira(valor_pago×10%) + OTE(valor_pago×faixa%)",
      snapshot_aplicado: false,
    },
    contratosNovos: contratosNovosCount,
    renovacoes: renovacoesCount,
  };
}

// ─── SDR calculation ────────────────────────────────────────

async function calcularSdr(
  emp: { id: string; nome: string; cargo: string; entity_id: string },
  sdrId: string,
  mesRef: string,
  faixas: FaixaRow[]
): Promise<ComissaoColaborador> {
  // Comparecimentos via FK sdr_id
  const { count: totalComp } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .eq("sdr_id", sdrId)
    .eq("mes_referencia", mesRef)
    .in("etapa", ETAPAS_COMPARECIMENTO);

  const comp = totalComp || 0;

  // Meta
  const { data: meta } = await supabase
    .from("metas_sdr")
    .select("meta_reunioes_agendadas, meta_reunioes_feitas")
    .eq("sdr_id", sdrId)
    .eq("mes_referencia", mesRef)
    .maybeSingle();

  const metaR = Number(
    meta?.meta_reunioes_feitas || meta?.meta_reunioes_agendadas || 0
  );
  const pctMeta = metaR > 0 ? (comp / metaR) * 100 : null;

  const faixa = pctMeta !== null ? findFaixa(faixas, pctMeta) : null;
  const valorPorReuniao = faixa?.valor || 0;
  const comissao = comp * valorPorReuniao;

  return {
    id: sdrId,
    employee_id: emp.id,
    nome: emp.nome,
    funcao: "sdr",
    recebe_comissao: true,
    comparecimentos: comp,
    meta_reunioes: metaR,
    valor_por_reuniao: valorPorReuniao,
    meta_pct: pctMeta,
    faixa_aplicada: faixa,
    comissao_total: comissao,
    fonte: `${comp} comparecimentos × R$${valorPorReuniao.toFixed(2)}`,
    snapshot_aplicado: false,
  };
}

// ─── Snapshot result (mes fechado) ──────────────────────────

async function buildSnapshotResult(
  mesRef: string,
  colaboradorId?: string,
  funcao?: string
): Promise<ComissaoResult> {
  let query = supabase
    .from("comissoes_mensais")
    .select("colaborador_id, colaborador_nome, tipo, valor_aprovado")
    .eq("mes_referencia", mesRef);

  if (colaboradorId) {
    query = query.eq("colaborador_id", colaboradorId);
  }

  const { data: rows } = await query;
  const colaboradores: ComissaoColaborador[] = [];

  for (const row of rows || []) {
    const isCloser = (row.tipo || "").toLowerCase().includes("closer");
    const isSdr =
      (row.tipo || "").toLowerCase().includes("sdr") ||
      (row.tipo || "").toLowerCase().includes("social");
    const fn: "closer" | "sdr" = isCloser ? "closer" : "sdr";

    if (funcao === "closer" && !isCloser) continue;
    if (funcao === "sdr" && !isSdr) continue;

    colaboradores.push({
      id: row.colaborador_id,
      employee_id: row.colaborador_id,
      nome: row.colaborador_nome || "",
      funcao: fn,
      recebe_comissao: true,
      meta_pct: null,
      faixa_aplicada: null,
      comissao_total: Number(row.valor_aprovado || 0),
      fonte: "snapshot (mes fechado)",
      snapshot_aplicado: true,
    });
  }

  const comissaoClosers = colaboradores
    .filter((c) => c.funcao === "closer")
    .reduce((s, c) => s + c.comissao_total, 0);
  const comissaoSdrs = colaboradores
    .filter((c) => c.funcao === "sdr")
    .reduce((s, c) => s + c.comissao_total, 0);

  return {
    mes_referencia: mesRef,
    colaboradores,
    totais: {
      comissao_closers: comissaoClosers,
      comissao_sdrs: comissaoSdrs,
      comissao_total: comissaoClosers + comissaoSdrs,
      contratos_novos_total: 0,
      renovacoes_total: 0,
    },
    mes_fechado: true,
  };
}
