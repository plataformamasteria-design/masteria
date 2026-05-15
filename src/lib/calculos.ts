import { startOfMonth, endOfMonth, isWeekend, eachDayOfInterval } from "date-fns";

export interface CloserStats {
  reunioes_marcadas: number;
  reunioes_feitas: number;
  contratos: number;
  meta_contratos: number;
  ticket_medio: number;
  ticket_meta: number;
}

export interface ScoreDetalhe {
  label: string;
  pontos: number;
  peso: string;
}

export function calcularScore(stats: CloserStats) {
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

  // 1. Taxa de Conversão (base 40%)
  const taxaConv = safe(stats.contratos, stats.reunioes_feitas) * 100;
  const convScore = taxaConv >= 25 ? 100 : taxaConv >= 20 ? 85 : taxaConv >= 15 ? 65 : taxaConv >= 10 ? 40 : 15;

  // 2. Atingimento de Meta (base 35%) — ignorado se meta = 0
  const metaAtiva = stats.meta_contratos > 0;
  const pctMeta = safe(stats.contratos, stats.meta_contratos) * 100;
  const metaScore = pctMeta >= 100 ? 100 : pctMeta >= 70 ? 70 : pctMeta >= 50 ? 40 : 10;

  // 3. Ticket Médio vs Ticket Meta (base 25%)
  const pctTicket = safe(stats.ticket_medio, stats.ticket_meta) * 100;
  const ticketScore = pctTicket >= 100 ? 100 : pctTicket >= 80 ? 75 : pctTicket >= 60 ? 50 : 20;

  // Pesos — se meta não configurada, redistribui proporcionalmente
  let wConv = 0.40, wMeta = 0.35, wTicket = 0.25;
  if (!metaAtiva) {
    const total = wConv + wTicket;
    wConv = wConv / total;
    wTicket = wTicket / total;
    wMeta = 0;
  }

  const score = Math.round(convScore * wConv + metaScore * wMeta + ticketScore * wTicket);

  const detalhes: ScoreDetalhe[] = [
    { label: "Taxa de conversão", pontos: convScore, peso: `${Math.round(wConv * 100)}%` },
  ];
  if (metaAtiva) {
    detalhes.push({ label: "Atingimento de meta", pontos: metaScore, peso: `${Math.round(wMeta * 100)}%` });
  }
  detalhes.push(
    { label: "Ticket vs meta", pontos: ticketScore, peso: `${Math.round(wTicket * 100)}%` },
  );

  return {
    score,
    status: (score >= 70 ? "saudavel" : score >= 45 ? "atencao" : "critico") as "saudavel" | "atencao" | "critico",
    detalhes,
  };
}

export function getDiasUteisDoMes(mesRef: string): number {
  const [year, month] = mesRef.split("-").map(Number);
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

export function getDiasUteisAte(mesRef: string, ate: Date): number {
  const [year, month] = mesRef.split("-").map(Number);
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = ate < endOfMonth(start) ? ate : endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

export function calcularMetaReversa(inputs: {
  mrrAlvo: number;
  taxaConv: number;
  taxaNoShow: number;
  ticketMedio: number;
  diasUteis: number;
  closers: number;
  ritmoAtual: number;
}) {
  const { mrrAlvo, taxaConv, taxaNoShow, ticketMedio, diasUteis, closers, ritmoAtual } = inputs;
  const contratos = Math.ceil(mrrAlvo / ticketMedio);
  const reunioesFeitas = Math.ceil(contratos / (taxaConv / 100));
  const reunioesMarcadas = Math.ceil(reunioesFeitas / (1 - taxaNoShow / 100));
  const leadsNecessarios = Math.ceil(reunioesMarcadas / 0.25);
  const contratosPerCloser = contratos / closers;
  const reunioesPerCloser = reunioesFeitas / closers;
  const contratosPerDia = diasUteis > 0 ? contratos / diasUteis : 0;
  const reunioesPerDia = diasUteis > 0 ? reunioesMarcadas / diasUteis : 0;
  const deltaRitmo = ritmoAtual > 0 ? ((contratosPerDia - ritmoAtual) / ritmoAtual) * 100 : 100;
  const viabilidade = deltaRitmo <= 10 ? "viavel" : deltaRitmo <= 40 ? "desafiador" : "fora_do_alcance";

  return {
    contratos, reunioesFeitas, reunioesMarcadas, leadsNecessarios,
    contratosPerCloser, reunioesPerCloser, contratosPerDia, reunioesPerDia,
    viabilidade: viabilidade as "viavel" | "desafiador" | "fora_do_alcance",
    deltaRitmo,
  };
}

/**
 * Calcula o valor_total_projeto (LTV) de um contrato/lead respeitando o flag
 * entrada_e_primeiro_mes. Usar este helper em TODOS os lugares que precisam
 * derivar o total — garante consistência com a fórmula canônica.
 *
 *   true  → entrada + mrr × (meses - 1)    (entrada já é o 1° mês)
 *   false → entrada + mrr × meses          (entrada separada do recorrente)
 */
export function calcValorTotalProjeto(args: {
  valor_entrada: number;
  mrr: number;
  meses: number;
  entrada_e_primeiro_mes?: boolean;
}): number {
  const ent = Number(args.valor_entrada || 0);
  const mrr = Number(args.mrr || 0);
  const meses = Math.max(0, Number(args.meses || 0));
  const primeiro = args.entrada_e_primeiro_mes ?? true;
  return primeiro ? ent + mrr * Math.max(0, meses - 1) : ent + mrr * meses;
}
