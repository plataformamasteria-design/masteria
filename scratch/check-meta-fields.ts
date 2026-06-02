import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const META_BASE = "https://graph.facebook.com/v21.0";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const actId = formatAccountId((cred.credentials as any).ad_account_id);
  
  function formatAccountId(raw: string) { return raw.startsWith("act_") ? raw : `act_${raw}`; }

  const qs = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,campaign_name,objective,actions,action_values,cost_per_action_type",
    time_range: JSON.stringify({ since: "2026-04-27", until: "2026-05-27" }),
    level: "campaign",
    limit: "10",
  });

  const res = await fetch(`${META_BASE}/${actId}/insights?${qs.toString()}`);
  const data = await res.json();
  
  console.log(JSON.stringify(data.data[0], null, 2));
}

main().catch(console.error);
