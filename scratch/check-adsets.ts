import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const META_BASE = "https://graph.facebook.com/v21.0";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const actId = (cred.credentials as any).ad_account_id.startsWith("act_") ? (cred.credentials as any).ad_account_id : `act_${(cred.credentials as any).ad_account_id}`;
  
  const qs = new URLSearchParams({
    access_token: token,
    fields: "id,name,adsets{optimization_goal,promoted_object}",
    limit: "5"
  });

  const res = await fetch(`${META_BASE}/${actId}/campaigns?${qs.toString()}`);
  const data = await res.json();
  
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
