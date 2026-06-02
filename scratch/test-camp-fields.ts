import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const actId = (cred.credentials as any).ad_account_id.startsWith("act_") ? (cred.credentials as any).ad_account_id : `act_${(cred.credentials as any).ad_account_id}`;
  
  const campaignFields = "id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time,adsets{status,daily_budget,lifetime_budget,promoted_object}";
  const qs = new URLSearchParams({ access_token: token, fields: campaignFields, limit: "2" });
  
  const res = await fetch(`https://graph.facebook.com/v21.0/${actId}/campaigns?${qs.toString()}`);
  const data = await res.json();
  
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
