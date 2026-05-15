/**
 * Coletor de decisoes pendentes que requerem acao do Lucas.
 * Agrega de multiplas fontes em lista priorizada.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export interface DecisaoPendente {
  categoria: "matching" | "ghl" | "financeiro" | "aprovacao" | "operacional";
  prioridade: "alta" | "media" | "baixa";
  titulo: string;
  quantidade: number;
  descricao: string;
  link: string;
}

export async function coletarDecisoesPendentes(): Promise<DecisaoPendente[]> {
  const decisoes: DecisaoPendente[] = [];
  const mesAtual = new Date().toISOString().slice(0, 7);

  // Executar queries em paralelo
  const [matchingRes, ghlRes, semCloserRes, aprovacoesRes] = await Promise.all([
    supabase.from("clientes_receita")
      .select("*", { count: "exact", head: true })
      .is("entrada_id", null)
      .in("status_financeiro", ["ativo", "pausado", "pagou_integral", "parceria"]),

    supabase.from("ghl_unmapped_users")
      .select("*", { count: "exact", head: true })
      .is("resolved_at", null),

    supabase.from("pagamentos_mensais")
      .select("*", { count: "exact", head: true })
      .is("closer", null)
      .eq("mes_referencia", mesAtual),

    supabase.from("contratos")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente_aprovacao")
      .eq("mes_referencia", mesAtual),
  ]);

  const matchCount = matchingRes.count || 0;
  const ghlCount = ghlRes.count || 0;
  const semCloserCount = semCloserRes.count || 0;
  const aprovacoesCount = aprovacoesRes.count || 0;

  if (matchCount > 0) {
    decisoes.push({
      categoria: "matching",
      prioridade: matchCount > 50 ? "alta" : matchCount > 10 ? "media" : "baixa",
      titulo: "Matchings pendentes",
      quantidade: matchCount,
      descricao: `${matchCount} clientes ativos sem vinculacao entrada_id — afeta ROAS e atribuicao`,
      link: "/admin/matching-clientes",
    });
  }

  if (ghlCount > 0) {
    decisoes.push({
      categoria: "ghl",
      prioridade: ghlCount > 5 ? "alta" : "media",
      titulo: "GHL users nao mapeados",
      quantidade: ghlCount,
      descricao: `${ghlCount} usuarios do GoHighLevel sem vinculo no sistema — leads sem closer`,
      link: "/admin/ghl-user-map",
    });
  }

  if (semCloserCount > 0) {
    decisoes.push({
      categoria: "financeiro",
      prioridade: semCloserCount > 30 ? "alta" : "media",
      titulo: "Recebimentos sem closer",
      quantidade: semCloserCount,
      descricao: `${semCloserCount} pagamentos de ${mesAtual} sem closer atribuido — comissoes incorretas`,
      link: "/recebimentos",
    });
  }

  if (aprovacoesCount > 0) {
    decisoes.push({
      categoria: "aprovacao",
      prioridade: "alta",
      titulo: "Aprovacoes pendentes",
      quantidade: aprovacoesCount,
      descricao: `${aprovacoesCount} contratos aguardando aprovacao — bloqueia faturamento`,
      link: "/financeiro/aprovacoes",
    });
  }

  // Ordenar por prioridade
  const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  decisoes.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);

  return decisoes;
}
