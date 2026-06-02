import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";

const META_BASE = "https://graph.facebook.com/v21.0";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  if (!creds.length) {
    console.log("No meta credentials found");
    return;
  }
  
  const cred = creds[0];
  const token = (cred.credentials as any).access_token;
  const accountId = (cred.credentials as any).ad_account_id;
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  
  console.log("Account:", actId);

  // Fetch insights for campaigns in last 30 days
  const since = "2026-04-27";
  const until = "2026-05-27"; // Adjusting based on user screenshot range
  
  const qs = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,campaign_name,actions,action_values",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    limit: "500",
  });

  const res = await fetch(`${META_BASE}/${actId}/insights?${qs.toString()}`);
  const data = await res.json();
  
  if (data.error) {
    console.error("Meta API error:", data.error);
    return;
  }

  const campaigns = data.data || [];
  console.log(`Found ${campaigns.length} campaigns with insights in this period.\n`);

  for (const camp of campaigns) {
    // Only print campaigns with "ENDFORMS" or "A MESA" to focus on the issue
    if (camp.campaign_name.includes("ENDFORMS") || camp.campaign_name.includes("A MESA")) {
      console.log(`\n=== Campaign: ${camp.campaign_name} ===`);
      console.log(`ID: ${camp.campaign_id}`);
      
      const actions = camp.actions || [];
      console.log(`Found ${actions.length} action types:`);
      for (const a of actions) {
        console.log(`  - ${a.action_type}: ${a.value}`);
      }
    }
  }
}

main().catch(console.error);
