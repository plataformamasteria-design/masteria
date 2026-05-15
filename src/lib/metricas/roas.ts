/**
 * ROAS canônico — cálculo real vs projetado.
 *
 * ROAS_real = SUM(contrato.mrr × clientes_receita.ltv_meses) / investimento
 * ROAS_projeto = SUM(contratos.valor_total_projeto) / investimento  (antigo, inflado)
 *
 * Fonte oficial de LTV: clientes_receita.ltv_meses
 * Fonte de investimento: ads_performance (spend total do mês via Meta API)
 *                        fallback: despesas categoria 'Ads'
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { getInvestimentoMensal } from "./investimento";

export interface RoasMensal {
  roas_real: number | null;
  roas_projeto: number | null;
  ltv_real_total: number;
  ltv_projeto_total: number;
  investimento: number;
  divergencia_pct: number;
  detalhes: {
    contratos_considerados: number;
    contratos_sem_ltv: number;
    ltv_meses_medio: number;
    fonte_ltv: "clientes_receita.ltv_meses";
    fonte_investimento: "meta_api" | "ads_performance" | "despesas";
  };
}

function mesBounds(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const since = `${mes}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const until = `${mes}-${String(lastDay).padStart(2, "0")}`;
  return { since, until };
}

async function getInvestimento(
  supabase: SupabaseClient,
  mes: string
): Promise<{ valor: number; fonte: "meta_api" | "ads_performance" | "despesas" }> {
  // Fonte primaria: Meta API via getInvestimentoMensal (SSOT)
  const invest = await getInvestimentoMensal(mes);
  if (invest.valor > 0) {
    return { valor: invest.valor, fonte: invest.fonte };
  }

  // Fallback: despesas categoria Ads
  const { data: despesas } = await supabase
    .from("despesas")
    .select("valor")
    .eq("mes_referencia", mes)
    .eq("categoria", "Ads")
    .is("deleted_at", null);

  const spendDesp = (despesas || []).reduce(
    (s, d) => s + Number(d.valor || 0),
    0
  );
  return { valor: spendDesp, fonte: "despesas" };
}

/**
 * Calcula ROAS real e projetado para um mês.
 */
export async function getRoasMensal(
  supabase: SupabaseClient,
  mesReferencia: string
): Promise<RoasMensal> {
  const { since, until } = mesBounds(mesReferencia);

  // 1. Contratos fechados no mês (status ativo)
  const { data: contratos } = await supabase
    .from("contratos")
    .select("id, mrr, valor_total_projeto, cliente_nome, cliente_id")
    .gte("data_fechamento", since)
    .lte("data_fechamento", until)
    .eq("status", "ativo");

  const cts = contratos || [];

  // 2. Buscar TODOS os clientes_receita com ltv_meses para match fuzzy
  //    Nomes divergem entre contratos e clientes_receita:
  //      contrato: "Isabella Garcia"
  //      clientes_receita: "ISABELLA GARCIA MENEZES"
  //    Estratégia: normalizar + match parcial por primeiro nome + sobrenome
  const { data: allCr } = await supabase
    .from("clientes_receita")
    .select("id, nome, ltv_meses, valor_mensal")
    .gt("ltv_meses", 0);

  const crList = (allCr || []) as {
    id: string; nome: string; ltv_meses: number; valor_mensal: number;
  }[];

  // Indexar por nome normalizado (UPPER + TRIM)
  const crNomeExatoMap = new Map(
    crList.map((cr) => [cr.nome?.toUpperCase()?.trim(), cr])
  );

  // Função de match: tenta exato, depois parcial (contém), depois primeiro+segundo nome
  function matchCliente(nomeContrato: string | null, clienteId: string | null) {
    if (!nomeContrato) return null;

    // 1. Match por cliente_id direto (se contrato.cliente_id = clientes_receita.id)
    if (clienteId) {
      const byId = crList.find((cr) => cr.id === clienteId);
      if (byId) return byId;
    }

    const nomeUp = nomeContrato.toUpperCase().trim();
    // Remover sufixo " - SS" ou similar
    const nomeClean = nomeUp.replace(/\s*-\s*SS$/i, "").trim();

    // 2. Match exato
    const exato = crNomeExatoMap.get(nomeClean) || crNomeExatoMap.get(nomeUp);
    if (exato) return exato;

    // 3. Match parcial: clientes_receita.nome contém o nome do contrato
    const parcial = crList.find((cr) => {
      const crNome = cr.nome?.toUpperCase()?.trim() || "";
      return crNome.includes(nomeClean) || nomeClean.includes(crNome);
    });
    if (parcial) return parcial;

    // 4. Match por primeiro + segundo nome
    const partes = nomeClean.split(/\s+/);
    if (partes.length >= 2) {
      const primeiro = partes[0];
      const segundo = partes[1];
      const fuzzy = crList.find((cr) => {
        const crNome = cr.nome?.toUpperCase()?.trim() || "";
        return crNome.includes(primeiro) && crNome.includes(segundo);
      });
      if (fuzzy) return fuzzy;
    }

    return null;
  }

  let ltvRealTotal = 0;
  let ltvProjetoTotal = 0;
  let contratosSemLtv = 0;
  const ltvMesesValues: number[] = [];

  for (const ct of cts) {
    // LTV projeto (antigo)
    ltvProjetoTotal += Number(ct.valor_total_projeto || 0);

    // LTV real: mrr × ltv_meses
    const cr = matchCliente(ct.cliente_nome, ct.cliente_id);

    if (cr && cr.ltv_meses && cr.ltv_meses > 0) {
      ltvRealTotal += Number(ct.mrr || 0) * Number(cr.ltv_meses);
      ltvMesesValues.push(Number(cr.ltv_meses));
    } else {
      contratosSemLtv++;
    }
  }

  // 3. Investimento
  const invest = await getInvestimento(supabase, mesReferencia);

  // 4. Calculos
  const roasReal =
    invest.valor > 0 ? ltvRealTotal / invest.valor : null;
  const roasProjeto =
    invest.valor > 0 ? ltvProjetoTotal / invest.valor : null;

  const divergenciaPct =
    roasReal && roasReal > 0
      ? ((roasProjeto || 0) - roasReal) / roasReal * 100
      : 0;

  const ltvMesesMedio =
    ltvMesesValues.length > 0
      ? ltvMesesValues.reduce((s, v) => s + v, 0) / ltvMesesValues.length
      : 0;

  return {
    roas_real: roasReal,
    roas_projeto: roasProjeto,
    ltv_real_total: ltvRealTotal,
    ltv_projeto_total: ltvProjetoTotal,
    investimento: invest.valor,
    divergencia_pct: divergenciaPct,
    detalhes: {
      contratos_considerados: cts.length,
      contratos_sem_ltv: contratosSemLtv,
      ltv_meses_medio: ltvMesesMedio,
      fonte_ltv: "clientes_receita.ltv_meses",
      fonte_investimento: invest.fonte,
    },
  };
}
