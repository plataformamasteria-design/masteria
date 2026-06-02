import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  // Let's find Diogo's account!
  let diogoToken = "";
  let diogoAccountId = "act_272808048526833"; // The ID from the screenshot! 272808048526833

  for (const c of creds) {
    // any token from the same user should work for their ad accounts
    diogoToken = (c.credentials as any).access_token;
    break;
  }
  
  const since = "2026-02-27";
  const until = "2026-05-28";

  const insightsParams = new URLSearchParams({
    access_token: diogoToken,
    fields: "campaign_id,campaign_name,actions",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    limit: "500",
  });
  
  const insRes = await fetch(`https://graph.facebook.com/v21.0/${diogoAccountId}/insights?${insightsParams.toString()}`);
  const insData = await insRes.json();
  
  console.log(JSON.stringify(insData.data.slice(0, 3).map((r: any) => ({
    name: r.campaign_name,
    actions: r.actions?.filter((a: any) => a.action_type.includes("messag") || a.action_type.includes("convers"))
  })), null, 2));
}

main().catch(console.error);
