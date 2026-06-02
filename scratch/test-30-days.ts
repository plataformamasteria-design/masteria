import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractActionsData, injectDerivedMetrics } from "../src/lib/meta-ads";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const actId = (cred.credentials as any).ad_account_id.startsWith("act_") ? (cred.credentials as any).ad_account_id : `act_${(cred.credentials as any).ad_account_id}`;
  
  // same dates as meta ads manager: 27 abr to 26 may
  const since = "2026-05-01";
  const until = "2026-05-28";

  const campaignFields = "id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time,adsets{status,daily_budget,lifetime_budget,promoted_object}";
  const qsStruct = new URLSearchParams({ access_token: token, fields: campaignFields, limit: "500" });
  
  const structRes = await fetch(`https://graph.facebook.com/v21.0/${actId}/campaigns?${qsStruct.toString()}`);
  const structureData = await structRes.json();

  const insightsParams = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,spend,impressions,clicks,reach,inline_link_clicks,actions,action_values,conversions",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    limit: "500",
  });
  
  const insRes = await fetch(`https://graph.facebook.com/v21.0/${actId}/insights?${insightsParams.toString()}`);
  const insData = await insRes.json();

  const results = [];

  for (const row of (insData.data || [])) {
    const id = row.campaign_id;
    let optimizedEventName = undefined;
    const cStruct = structureData.data?.find((c: any) => c.id === id);
    if (cStruct && cStruct.adsets && cStruct.adsets.data && cStruct.adsets.data.length > 0) {
      const po = cStruct.adsets.data[0].promoted_object;
      if (po) {
        optimizedEventName = po.custom_event_str || po.custom_event_type;
      }
    }

    const ex = extractActionsData(row.actions || [], row.action_values || [], row.conversions || [], optimizedEventName);
    
    // mimic route.ts dynamicResult
    let dynamicResults = 0;
    const obj = cStruct?.objective || "";
    const isCustomEvent = optimizedEventName && optimizedEventName !== "LEAD" && optimizedEventName !== "OTHER" && optimizedEventName !== "PURCHASE" && optimizedEventName !== "LINK_CLICK";
    if (optimizedEventName && (optimizedEventName === "LEAD" || isCustomEvent)) {
      dynamicResults = ex.ld;
    } else if (obj.includes("LEAD")) dynamicResults = ex.ld;
    else if (obj.includes("SALE") || obj.includes("CONVERSION") || obj.includes("PURCHASE")) dynamicResults = ex.pur;
    else if (obj.includes("ENGAGEMENT") || obj.includes("MESSAGE")) dynamicResults = ex.msg;

    results.push({
      name: cStruct?.name,
      objective: obj,
      optimizedEventName,
      extracted_ld: ex.ld,
      dynamicResults
    });
  }

  console.log(JSON.stringify(results.filter(r => r.name?.includes("[A MESA]") || r.name?.includes("EVENTO-GCR") || r.name?.includes("EDN7")), null, 2));
}

main().catch(console.error);
