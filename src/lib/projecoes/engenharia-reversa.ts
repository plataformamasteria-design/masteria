/**
 * engenhariaReversa() — Dado uma meta (faturamento, MRR ou entradas),
 * calcula 3 caminhos para atingi-la ajustando alavancas diferentes.
 *
 * Cada caminho ajusta 1-2 alavancas e projeta o resultado.
 * Viabilidade: <15% variacao = alta, 15-40% = media, >40% = baixa.
 * Se nenhuma alavanca individual basta, sugere combinacao de 2.
 */
import type { BaseSimulacao } from "./base-simulacao";
import { simularCenario, type Visualizacao } from "./simular";

const LTV_MESES = 4.3;

interface MetaInput {
  tipo: "faturamento" | "mrr" | "entradas";
  valor: number;
}

interface CaminhoSugerido {
  titulo: string;
  ajustes: Record<string, number | string>;
  resultado_projetado: Record<string, number | null>;
  viabilidade: "alta" | "media" | "baixa";
  observacao: string;
}

interface ResultadoEngenhariaReversa {
  meta: { tipo: string; valor: number; periodo: string };
  caminhos: CaminhoSugerido[];
  alavanca_mais_sensivel: string;
}

function viabilidade(variacao_pct: number): "alta" | "media" | "baixa" {
  const abs = Math.abs(variacao_pct);
  if (abs < 15) return "alta";
  if (abs <= 40) return "media";
  return "baixa";
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function engenhariaReversa(
  meta: MetaInput,
  base: BaseSimulacao,
  visualizacao: Visualizacao = "mes"
): ResultadoEngenhariaReversa {
  const m = visualizacao === "trimestre" ? 3 : visualizacao === "anual" ? 12 : 1;
  // Normalizar meta para valor mensal
  const metaMensal = meta.valor / m;

  // Determinar contratos necessarios baseado no tipo de meta
  const mrrMedio = base.saude_financeira.mrr_medio_contrato;
  const clientesAtivos = base.saude_financeira.clientes_ativos;

  let contratosNecessarios: number;
  if (meta.tipo === "mrr") {
    contratosNecessarios = mrrMedio > 0 ? metaMensal / mrrMedio : 0;
  } else if (meta.tipo === "entradas") {
    contratosNecessarios = mrrMedio > 0 ? metaMensal / mrrMedio : 0;
  } else {
    // faturamento = (clientes_ativos * mrr_medio) + (novos * mrr_medio)
    const faturamentoCarteira = clientesAtivos * mrrMedio;
    const faturamentoNovosNecessario = Math.max(0, metaMensal - faturamentoCarteira);
    contratosNecessarios = mrrMedio > 0 ? faturamentoNovosNecessario / mrrMedio : 0;
  }

  // Valores base
  const baseReunioesAgendadas = base.funil.reunioes_agendadas;
  const baseNoShowPct = base.funil.taxa_no_show_pct;
  const baseConvCloserPct = base.funil.taxa_conversao_closer_pct;
  const baseMrrMedio = base.saude_financeira.mrr_medio_contrato;
  const baseContratosNovos = base.saude_financeira.contratos_novos;

  // Reunioes feitas necessarias
  const reunioesFeitasNecessarias = baseConvCloserPct > 0
    ? contratosNecessarios / (baseConvCloserPct / 100)
    : 0;

  // --- Caminho 1: Aumentar volume (reunioes agendadas) ---
  const reunioesAgendadasNecessarias = (1 - baseNoShowPct / 100) > 0
    ? reunioesFeitasNecessarias / (1 - baseNoShowPct / 100)
    : reunioesFeitasNecessarias;

  const variacaoVolume = baseReunioesAgendadas > 0
    ? ((reunioesAgendadasNecessarias - baseReunioesAgendadas) / baseReunioesAgendadas) * 100
    : 0;

  const resultadoVolume = simularCenario(
    { reunioes_agendadas: reunioesAgendadasNecessarias },
    base,
    "mes"
  );

  const caminhoVolume: CaminhoSugerido = {
    titulo: "Aumentar volume",
    ajustes: {
      reunioes_agendadas: `${round2(baseReunioesAgendadas)} → ${round2(reunioesAgendadasNecessarias)} (+${round2(variacaoVolume)}%)`,
    },
    resultado_projetado: resultadoVolume.derivados,
    viabilidade: viabilidade(variacaoVolume),
    observacao: `Exige escalar operacao SDR em ${round2(Math.abs(variacaoVolume))}%`,
  };

  // --- Caminho 2: Aumentar conversao closer ---
  const convNecessaria = baseReunioesAgendadas > 0
    ? (contratosNecessarios / (baseReunioesAgendadas * (1 - baseNoShowPct / 100))) * 100
    : 0;

  const variacaoConv = baseConvCloserPct > 0
    ? ((convNecessaria - baseConvCloserPct) / baseConvCloserPct) * 100
    : 0;

  const resultadoConv = simularCenario(
    { taxa_conversao_closer_pct: Math.min(convNecessaria, 100) },
    base,
    "mes"
  );

  const caminhoConversao: CaminhoSugerido = {
    titulo: "Aumentar conversao",
    ajustes: {
      taxa_conversao_closer_pct: `${round2(baseConvCloserPct)}% → ${round2(Math.min(convNecessaria, 100))}% (+${round2(variacaoConv)}%)`,
    },
    resultado_projetado: resultadoConv.derivados,
    viabilidade: viabilidade(variacaoConv),
    observacao: convNecessaria > 100
      ? "Impossivel: taxa necessaria > 100%. Combine com outra alavanca."
      : `Taxa de fechamento precisa subir de ${round2(baseConvCloserPct)}% para ${round2(convNecessaria)}%`,
  };

  // --- Caminho 3: Aumentar MRR medio ---
  const reunioesFeitas = baseReunioesAgendadas * (1 - baseNoShowPct / 100);
  const contratosComBaseAtual = reunioesFeitas * (baseConvCloserPct / 100);
  const mrrNecessario = contratosComBaseAtual > 0
    ? metaMensal / contratosComBaseAtual
    : metaMensal;

  // Ajustar calculo baseado no tipo de meta
  let mrrMedioNecessario: number;
  if (meta.tipo === "faturamento") {
    const faturamentoCarteira = clientesAtivos * baseMrrMedio;
    const faturamentoNovosNecessario = Math.max(0, metaMensal - faturamentoCarteira);
    mrrMedioNecessario = contratosComBaseAtual > 0
      ? faturamentoNovosNecessario / contratosComBaseAtual
      : baseMrrMedio;
  } else {
    mrrMedioNecessario = contratosComBaseAtual > 0
      ? metaMensal / contratosComBaseAtual
      : baseMrrMedio;
  }

  const variacaoMrr = baseMrrMedio > 0
    ? ((mrrMedioNecessario - baseMrrMedio) / baseMrrMedio) * 100
    : 0;

  const resultadoMrr = simularCenario(
    { mrr_medio_contrato: mrrMedioNecessario },
    base,
    "mes"
  );

  const caminhoMrr: CaminhoSugerido = {
    titulo: "Aumentar MRR medio",
    ajustes: {
      mrr_medio_contrato: `R$ ${round2(baseMrrMedio)} → R$ ${round2(mrrMedioNecessario)} (+${round2(variacaoMrr)}%)`,
    },
    resultado_projetado: resultadoMrr.derivados,
    viabilidade: viabilidade(variacaoMrr),
    observacao: `Ticket medio precisa subir de R$ ${round2(baseMrrMedio)} para R$ ${round2(mrrMedioNecessario)}`,
  };

  // Ordenar caminhos por viabilidade
  const prioridade = { alta: 0, media: 1, baixa: 2 };
  const caminhos = [caminhoVolume, caminhoConversao, caminhoMrr]
    .sort((a, b) => prioridade[a.viabilidade] - prioridade[b.viabilidade]);

  // Se nenhum caminho individual e viavel (todos "baixa"), sugerir combinacao
  if (caminhos.every((c) => c.viabilidade === "baixa")) {
    // Combinacao: metade do delta em volume + metade em conversao
    const meioReunioesAgendadas = (baseReunioesAgendadas + reunioesAgendadasNecessarias) / 2;
    const reunioesFeitasCombo = meioReunioesAgendadas * (1 - baseNoShowPct / 100);
    const convCombo = contratosNecessarios > 0 && reunioesFeitasCombo > 0
      ? (contratosNecessarios / reunioesFeitasCombo) * 100
      : baseConvCloserPct;

    const resultadoCombo = simularCenario(
      { reunioes_agendadas: meioReunioesAgendadas, taxa_conversao_closer_pct: Math.min(convCombo, 100) },
      base,
      "mes"
    );

    const varVol = baseReunioesAgendadas > 0
      ? ((meioReunioesAgendadas - baseReunioesAgendadas) / baseReunioesAgendadas) * 100
      : 0;
    const varConv = baseConvCloserPct > 0
      ? ((convCombo - baseConvCloserPct) / baseConvCloserPct) * 100
      : 0;

    caminhos.push({
      titulo: "Combinacao volume + conversao",
      ajustes: {
        reunioes_agendadas: `+${round2(varVol)}%`,
        taxa_conversao_closer_pct: `+${round2(varConv)}%`,
      },
      resultado_projetado: resultadoCombo.derivados,
      viabilidade: viabilidade(Math.max(Math.abs(varVol), Math.abs(varConv))),
      observacao: "Distribui o esforco entre escalar volume e melhorar conversao",
    });
  }

  // Alavanca mais sensivel: qual variacao % gera mais impacto
  const sensibilidades = [
    { alavanca: "reunioes_agendadas", variacao: Math.abs(variacaoVolume) > 0 ? contratosNecessarios / Math.abs(variacaoVolume) : 0 },
    { alavanca: "taxa_conversao_closer_pct", variacao: Math.abs(variacaoConv) > 0 ? contratosNecessarios / Math.abs(variacaoConv) : 0 },
    { alavanca: "mrr_medio_contrato", variacao: Math.abs(variacaoMrr) > 0 ? contratosNecessarios / Math.abs(variacaoMrr) : 0 },
  ];
  const maisEficiente = sensibilidades.sort((a, b) => b.variacao - a.variacao)[0];

  return {
    meta: {
      tipo: meta.tipo,
      valor: meta.valor,
      periodo: visualizacao,
    },
    caminhos,
    alavanca_mais_sensivel: maisEficiente.alavanca,
  };
}
