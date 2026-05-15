import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketingCampaigns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const latest = await db.select({ syncedAt: marketingCampaigns.syncedAt }).from(marketingCampaigns).orderBy(desc(marketingCampaigns.syncedAt)).limit(1);
    
    if (latest.length > 0 && latest[0].syncedAt) {
      return NextResponse.json({ timestamp: latest[0].syncedAt });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
