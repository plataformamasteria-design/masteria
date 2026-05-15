import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingCampaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.companyId, auth.companyId));
    
    let contas_em_risco = 0;
    let contas_escala = 0;
    let contas_estaveis = 0;

    campaigns.forEach(c => {
      const spend = parseFloat(c.spend || "0");
      const leads = c.conversions || 0;
      const cpl = leads > 0 ? spend / leads : 0;
      
      if (cpl > 50 || (spend > 100 && leads === 0)) contas_em_risco++;
      else if (cpl > 0 && cpl < 15 && spend > 50) contas_escala++;
      else contas_estaveis++;
    });

    const stats = {
      contas_total: campaigns.length,
      contas_em_risco,
      contas_estaveis,
      contas_escala,
      critical: contas_em_risco * 2,
      high: contas_em_risco,
      total_alerts: contas_em_risco * 3,
      last_sync_at: campaigns.length > 0 ? campaigns[0].syncedAt?.toISOString() : new Date().toISOString()
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[api/ad-intelligence/stats]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
