import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { addMockBatch } from "../batch-action/route";
import { db } from "@/lib/db";
import { marketingCampaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.companyId, auth.companyId));
    
    // Create a mock analysis batch based on campaigns
    const underperforming = campaigns.filter(c => {
      const spend = parseFloat(c.spend || "0");
      const leads = c.conversions || 0;
      const cpl = leads > 0 ? spend / leads : 0;
      return cpl > 50 || (spend > 100 && leads === 0);
    });

    if (underperforming.length > 0) {
      const newBatchId = `batch_${Date.now()}`;
      const batchItems = underperforming.map((c, i) => ({
        id: `item_${Date.now()}_${i}`,
        account_id: c.campaignId,
        account_name: c.campaignName || "Campanha Desconhecida",
        diagnosis: "Campanha com CPL muito alto ou sem conversões após gasto significativo.",
        suggested_action: "Pausar anúncios com pior CTR e testar novos criativos.",
        confidence_level: "alta",
        status: "pending"
      }));

      addMockBatch({
        id: newBatchId,
        title: "Otimização de Campanhas em Risco",
        niche: "Geral",
        general_diagnosis: "Foram identificadas campanhas consumindo orçamento sem gerar leads com custo aceitável.",
        status: "pending",
        ad_intelligence_batch_items: batchItems,
        created_at: new Date().toISOString()
      });

      return NextResponse.json({ success: true, created_batches: 1 });
    }

    return NextResponse.json({ success: true, created_batches: 0 });
  } catch (error: any) {
    console.error("[api/ad-intelligence/cluster-analysis]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
