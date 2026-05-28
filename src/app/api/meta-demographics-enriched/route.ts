import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE, extractActionsData } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) {
      return NextResponse.json({ error: "Conta de anúncios não selecionada" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const until = searchParams.get("until") || new Date().toISOString().slice(0, 10);
    const breakdown = searchParams.get("breakdown") || "age_gender";
    const accountParam = searchParams.get("account_id");
    
    const account = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : (auth.accountId.startsWith("act_") ? auth.accountId : `act_${auth.accountId}`);

    let metaBreakdowns = "age,gender";
    if (breakdown === "region") metaBreakdowns = "region";
    if (breakdown === "device") metaBreakdowns = "impression_device";
    if (breakdown === "platform") metaBreakdowns = "publisher_platform";
    if (breakdown === "placement") metaBreakdowns = "publisher_platform,platform_position";

    const insightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "spend,impressions,clicks,actions,action_values",
      time_range: JSON.stringify({ since, until }),
      level: "account",
      breakdowns: metaBreakdowns,
      limit: "500",
    });

    const r = await fetch(`${META_BASE}/${account}/insights?${insightsParams.toString()}`);
    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`Meta API Error: ${r.status} - ${errBody}`);
    }
    
    const json = await r.json();
    const rows = json.data || [];

    const mappedData = rows.map((row: any) => {
      const spend = parseFloat(row.spend || "0");
      const impressions = parseInt(row.impressions || "0");
      const clicks = parseInt(row.clicks || "0");
      
      const { ld, msg } = extractActionsData(row.actions || [], row.action_values || []);
      const leads = ld + msg;

      let label = "Unknown";
      let sublabel = "";

      if (breakdown === "age_gender") {
        label = row.age || "Unknown";
        sublabel = row.gender === "male" ? "Masculino" : row.gender === "female" ? "Feminino" : "Outros";
      } else if (breakdown === "region") {
        label = row.region || "Unknown";
      } else if (breakdown === "device") {
        label = row.impression_device || "Unknown";
      } else if (breakdown === "platform") {
        label = row.publisher_platform || "Unknown";
      } else if (breakdown === "placement") {
        const pos = String(row.platform_position || "Unknown").toLowerCase();
        const plat = String(row.publisher_platform || "Unknown").toLowerCase();
        
        label = pos === 'feed' ? 'Feed' : pos === 'story' ? 'Stories' : pos === 'reels' ? 'Reels' : pos === 'marketplace' ? 'Marketplace' : pos === 'explore' ? 'Explorar' : pos === 'inbox' ? 'Inbox' : pos === 'search' ? 'Busca' : pos;
        sublabel = plat === 'instagram' ? 'Instagram' : plat === 'facebook' ? 'Facebook' : plat === 'audience_network' ? 'Audience Network' : plat === 'messenger' ? 'Messenger' : plat;
      }

      return {
        label,
        sublabel,
        spend,
        impressions,
        clicks,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        // Mocking CRM estimates proportionally for UI
        qualificados_est: Math.floor(leads * 0.4),
        taxa_qualificacao_est: leads > 0 ? 40 : null,
        reunioes_realizadas_est: Math.floor(leads * 0.1),
        contratos_est: Math.floor(leads * 0.05),
        mrr_gerado_est: Math.floor(leads * 0.05) * 1500, // 1500 per contract mock
        cac_est: Math.floor(leads * 0.05) > 0 ? spend / Math.floor(leads * 0.05) : null,
        roas_cash_est: spend > 0 ? (Math.floor(leads * 0.05) * 1500) / spend : null,
        estimado: true,
      };
    });

    return NextResponse.json({ 
      data: mappedData,
      permite_contratos: true 
    });

  } catch (err: any) {
    console.error("[api/meta-demographics-enriched]", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
