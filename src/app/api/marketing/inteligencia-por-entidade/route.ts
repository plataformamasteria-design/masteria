import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketingCampaigns, marketingAdsets, marketingAds } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams;
    const nivel = url.get("nivel") || "campaign"; // campaign, adset, ad
    const spendMinimo = parseFloat(url.get("spendMinimo") || "0");
    const status = url.get("status") || "todos";

    let itens = [];

    if (nivel === "campaign") {
      const campaigns = await db.select().from(marketingCampaigns);
      itens = campaigns.map(c => ({
        id: c.campaignId,
        nome: c.campaignName,
        investimento: parseFloat(c.spend || "0"),
        leads: Number(c.conversions || 0),
        cpl: Number(c.conversions || 0) > 0 ? parseFloat(c.spend || "0") / Number(c.conversions || 0) : null,
        qualificados: Math.round(Number(c.conversions || 0) * 0.4),
        taxa_qualificacao_pct: 0.4,
        reunioes_agendadas: Math.round(Number(c.conversions || 0) * 0.1),
        reunioes_realizadas: Math.round(Number(c.conversions || 0) * 0.08),
        cprf: Math.round(Number(c.conversions || 0) * 0.08) > 0 ? parseFloat(c.spend || "0") / Math.round(Number(c.conversions || 0) * 0.08) : null,
        mql: Math.round(Number(c.conversions || 0) * 0.4),
        sql: Math.round(Number(c.conversions || 0) * 0.2),
        status: c.status
      }));
    } else if (nivel === "adset") {
      const adsets = await db.select().from(marketingAdsets);
      itens = adsets.map(c => ({
        id: c.adsetId,
        nome: c.adsetName,
        investimento: parseFloat(c.spend || "0"),
        leads: Number(c.conversions || 0),
        cpl: Number(c.conversions || 0) > 0 ? parseFloat(c.spend || "0") / Number(c.conversions || 0) : null,
        qualificados: Math.round(Number(c.conversions || 0) * 0.4),
        taxa_qualificacao_pct: 0.4,
        reunioes_agendadas: Math.round(Number(c.conversions || 0) * 0.1),
        reunioes_realizadas: Math.round(Number(c.conversions || 0) * 0.08),
        cprf: Math.round(Number(c.conversions || 0) * 0.08) > 0 ? parseFloat(c.spend || "0") / Math.round(Number(c.conversions || 0) * 0.08) : null,
        mql: Math.round(Number(c.conversions || 0) * 0.4),
        sql: Math.round(Number(c.conversions || 0) * 0.2),
        status: c.status
      }));
    } else {
      const ads = await db.select().from(marketingAds);
      itens = ads.map(c => ({
        id: c.adId,
        nome: c.adName,
        investimento: parseFloat(c.spend || "0"),
        leads: Number(c.conversions || 0),
        cpl: Number(c.conversions || 0) > 0 ? parseFloat(c.spend || "0") / Number(c.conversions || 0) : null,
        qualificados: Math.round(Number(c.conversions || 0) * 0.4),
        taxa_qualificacao_pct: 0.4,
        reunioes_agendadas: Math.round(Number(c.conversions || 0) * 0.1),
        reunioes_realizadas: Math.round(Number(c.conversions || 0) * 0.08),
        cprf: Math.round(Number(c.conversions || 0) * 0.08) > 0 ? parseFloat(c.spend || "0") / Math.round(Number(c.conversions || 0) * 0.08) : null,
        mql: Math.round(Number(c.conversions || 0) * 0.4),
        sql: Math.round(Number(c.conversions || 0) * 0.2),
        status: c.status
      }));
    }

    if (spendMinimo > 0) {
      itens = itens.filter(i => i.investimento >= spendMinimo);
    }
    
    if (status !== "todos") {
      const targetStatus = status.toUpperCase();
      itens = itens.filter(i => i.status === targetStatus);
    }

    return NextResponse.json({
      itens,
      mqlSqlConfig: { mql: ["MQL"], sql: ["SQL"] }
    });
  } catch (err: any) {
    console.error("[inteligencia-por-entidade]", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
