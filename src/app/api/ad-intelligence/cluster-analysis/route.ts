import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
// LLM takes time for large cluster evaluations (~15-20s)
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

// Pega o token nativo pra reusar se possível.
const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";

interface LocalAccountData {
  id: string;
  name: string;
}

export async function POST() {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    const startTime = Date.now();

    // 1. Fetch Ad Accounts to get the names
    const accountsFetch = await fetch("https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&limit=100", {
      headers: { Authorization: `Bearer ${TOKEN()}` }
    });
    const accountsData = await accountsFetch.json();
    const accountMap = new Map<string, string>();
    (accountsData.data || []).forEach((a: any) => {
      const id = a.id.startsWith("act_") ? a.id : `act_${a.id}`;
      accountMap.set(id, a.name);
    });

    // 2. Fetch Creative Scores & Audience Performance
    // Se a coluna account_id foi preenchida pelo env/processo
    const [{ data: cs }, { data: ap }] = await Promise.all([
      supabase.from("creative_scores").select("*"),
      supabase.from("audience_performance").select("*")
    ]);

    if (!cs || cs.length === 0) {
      return NextResponse.json({ error: "Nenhum dado encontrado em creative_scores" }, { status: 400 });
    }

    // 3. Fetch AI Memory Rules
    const { data: memory } = await supabase
      .from("ad_intelligence_memory")
      .select("context_type, account_id, learning_text")
      .eq("active", true);

    const memoryParams = (memory || []).map(m => {
      if (m.context_type === "global") return `REGRA GLOBAL: ${m.learning_text}`;
      return `REGRA PARA CONTA ${m.account_id || 'ID Desconhecido'}: ${m.learning_text}`;
    }).join("\n");

    // Formata o payload de dados curados para o LLM. Limita para evitar tokens massivos excessos.
    const clusterPayload = cs.map(c => ({
      acc_id: c.account_id || "act_unknown",
      acc_name: c.account_id ? (accountMap.get(c.account_id) || "Conta Oculta") : "Conta Oculta",
      niche: c.campaign_name?.split("-")[0]?.trim() || "Genérico", // heuristic para nicho baseando na convencao do nome
      ad: c.ad_name,
      spend: c.spend,
      leads: c.total_leads,
      qualFreq: (c.qualification_rate * 100).toFixed(0) + "%",
      meetings: c.meetings_held,
      mrr: c.total_mrr,
      score: c.composite_score,
      status: c.alert_status
    }));

    // Agrupa por conta para as métricas da dashboard
    const accountsSummary = new Map<string, { total_spend: number; total_mrr: number; avg_score: number; risk_items: number }>();
    clusterPayload.forEach(c => {
      const exist = accountsSummary.get(c.acc_id) || { total_spend: 0, total_mrr: 0, avg_score: 0, risk_items: 0, count: 0 };
      exist.total_spend += Number(c.spend || 0);
      exist.total_mrr += Number(c.mrr || 0);
      exist.avg_score += Number(c.score || 0);
      exist.risk_items += c.status === "critical" ? 1 : 0;
      //@ts-ignore
      exist.count += 1;
      accountsSummary.set(c.acc_id, exist);
    });

    // Dashboard metrics pre-LLM
    const dashStats = {
      contas_total: accountsSummary.size,
      contas_em_risco: 0,
      contas_estaveis: 0,
      contas_escala: 0
    };

    accountsSummary.forEach(v => {
      //@ts-ignore
      const score = v.avg_score / v.count;
      if (v.risk_items > 0 || score < 40) dashStats.contas_em_risco++;
      else if (score > 75) dashStats.contas_escala++;
      else dashStats.contas_estaveis++;
    });

    const llmPrompt = `Você é um Gestor de Tráfego AI C-Level.
Analise os dados agrupados de múltiplos clientes do cluster.
Encontre padrões (ex: Frequência alta no nicho XYZ) que afetam MÚLTIPLAS contas. Crie Ações em Lote ("Smart Batches").
Mantenha o diagnóstico geral por nicho/padrão, mas CRIE um diagnóstico/ação individual para as contas envolvidas baseando-se em seus dados.

REGRAS E EXCEÇÕES (Memória):
${memoryParams || "Nenhuma regra gravada ainda."}

DADOS DO CLUSTER:
${JSON.stringify(clusterPayload.slice(0, 500))} // limitando a 500 para tokens

FORMATO DA SAÍDA ESPERADA: Vc deve retornar um JSON válido compatível com o schema Zod abaixo.
Não adicione markdown ou blocos \`\`\`. Retorne APENAS o JSON puro.

{
  "batches": [
    {
      "title": "Renovação de Criativos no nicho Trabalhista",
      "niche": "Trabalhista",
      "general_diagnosis": "Saturação de criativos em 3 contas com queda clara de score e MRR zero no dia",
      "items": [
        {
          "account_id": "act_12345",
          "account_name": "Cliente X",
          "diagnosis": "Qualificação baixa de 10%",
          "suggested_action": "Substituir copy focada no gatilho A",
          "confidence_level": "alta"
        }
      ]
    }
  ]
}
`;

    const aiResult = await callAI({
      provider: "google-flash",
      maxTokens: 4000,
      systemPrompt: "Você é um Analista de Dados AI operando no backend. Apenas valide os dados e formule a resposta JSON estrita.",
      userContent: llmPrompt
    });

    let parsedResponse;
    try {
      const pureTxt = aiResult.text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResponse = JSON.parse(pureTxt);
    } catch(e) {
      console.error("AI JSON Parse error", e);
      return NextResponse.json({ error: "A IA não conseguiu estruturar as ações em lote." }, { status: 500 });
    }

    if (!parsedResponse.batches || !Array.isArray(parsedResponse.batches)) {
      return NextResponse.json({ error: "Formato inesperado." }, { status: 500 });
    }

    // Gravar no Supabase (ad_intelligence_batches -> ad_intelligence_batch_items)
    const storedBatches = [];

    for (const batch of parsedResponse.batches) {
      if (!batch.items || batch.items.length === 0) continue;
      
      const { data: bData, error: bErr } = await supabase.from("ad_intelligence_batches").insert({
        title: batch.title,
        niche: batch.niche,
        general_diagnosis: batch.general_diagnosis,
        status: "pending"
      }).select().single();

      if (!bErr && bData) {
        storedBatches.push(bData);
        
        const itemsToInsert = batch.items.map((i: any) => ({
          batch_id: bData.id,
          account_id: i.account_id,
          account_name: i.account_name,
          diagnosis: i.diagnosis,
          suggested_action: i.suggested_action,
          confidence_level: i.confidence_level || 'alta'
        }));

        await supabase.from("ad_intelligence_batch_items").insert(itemsToInsert);
      }
    }

    return NextResponse.json({ 
      success: true, 
      dashStats, 
      created_batches: storedBatches.length,
      duration_ms: Date.now() - startTime
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ClusterAnalysis Error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
