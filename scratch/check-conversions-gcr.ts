import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const actId = (cred.credentials as any).ad_account_id.startsWith("act_") ? (cred.credentials as any).ad_account_id : `act_${(cred.credentials as any).ad_account_id}`;
  
  const qs = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,campaign_name,objective,actions,conversions",
    time_range: JSON.stringify({ since: "2026-04-27", until: "2026-05-27" }),
    level: "campaign",
    filtering: JSON.stringify([{field: "campaign.name", operator: "CONTAIN", value: "EVENTO-GCR"}]),
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/${actId}/insights?${qs.toString()}`);
  const data = await res.json();
  
  console.log(JSON.stringify(data.data, null, 2));
}

main().catch(console.error);
