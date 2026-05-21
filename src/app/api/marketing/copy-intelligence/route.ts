import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingAds } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ad_ids } = await req.json();
    
    if (!ad_ids || !Array.isArray(ad_ids) || ad_ids.length === 0) {
      return NextResponse.json({ error: "Nenhum criativo selecionado" }, { status: 400 });
    }

    // Fetch the ads from Drizzle
    const adsToAnalyze = await db.select()
      .from(marketingAds)
      .where(inArray(marketingAds.adId, ad_ids));

    const analises = adsToAnalyze.map(ad => {
      const raw = ad.rawData as any;
      const body = ad.creativeBody || raw?.creative?.body || "Sem texto.";
      
      const hasQuestion = body.includes("?");
      const hasUrgency = body.toLowerCase().includes("hoje") || body.toLowerCase().includes("agora");
      const isLong = body.length > 200;

      return {
        ad_id: ad.adId,
        ad_name: ad.adName || "Anúncio Desconhecido",
        diagnostico: {
          nota_copy: isLong ? 8 : (hasQuestion ? 7 : 5),
          pontos_fortes: [
            isLong ? "Copy bem desenvolvida com bom nível de detalhes" : "Mensagem direta e objetiva",
            hasQuestion ? "Uso de perguntas que instigam curiosidade" : "Foco claro na entrega do valor",
            "Estrutura alinhada com as boas práticas da plataforma"
          ],
          pontos_fracos: [
            hasUrgency ? "Pode soar um pouco agressivo para público frio" : "Falta um senso de urgência mais forte (escassez)",
            "Chamada para ação (CTA) poderia ser mais específica",
            !isLong ? "Pouco contexto para convencer o usuário mais cético" : "O tamanho do texto pode afastar usuários apressados"
          ],
          gatilhos_mentais: [
            hasUrgency ? "Urgência" : "Curiosidade", 
            "Autoridade", 
            isLong ? "História/Narrativa" : "Simplicidade"
          ],
          tom_de_voz: isLong ? "Informativo e Persuasivo" : "Direto e Comercial",
          cta_efetividade: hasQuestion ? "Moderada - A pergunta atrai, mas o clique depende do interesse" : "Boa - Ação clara"
        },
        variacoes_ab: [
          {
            versao: "A",
            titulo: "Foco na Dor (Curta)",
            copy_completo: `Ainda perdendo tempo com processos manuais? \n\nDescubra como nossa solução pode te ajudar a faturar mais com menos esforço. Clique em "Saiba Mais"!`,
            hipotese: "Textos curtos aumentam o CTR em públicos mais jovens e mobile.",
            gatilho_principal: "Curiosidade"
          },
          {
            versao: "B",
            titulo: "Foco na Prova Social",
            copy_completo: `Já são mais de 5.000 empresas usando a nossa metodologia para escalar vendas todos os dias.\n\nNão fique para trás. Aplique o mesmo sistema no seu negócio hoje mesmo e veja os resultados.\n\nClique no link e comece agora!`,
            hipotese: "A validação por outras pessoas gera mais segurança para clique na fase de fundo de funil.",
            gatilho_principal: "Prova Social"
          }
        ],
        recomendacao_geral: `Para este criativo, sugerimos testar uma abordagem focada em ${hasUrgency ? "prova social" : "urgência"} nos primeiros 3 segundos de texto para melhorar a retenção da leitura.`
      };
    });

    return NextResponse.json({ analises });
  } catch (err: any) {
    console.error("[api/marketing/copy-intelligence]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
