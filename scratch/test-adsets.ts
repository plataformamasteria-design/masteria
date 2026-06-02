import { db } from "../src/lib/db";
import { marketingCredentials } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.platform, "meta"));
  let diogoToken = "";
  let diogoAccountId = "act_272808048526833"; 

  for (const c of creds) {
    diogoToken = (c.credentials as any).access_token;
    break;
  }
  
  const r = await fetch(`https://graph.facebook.com/v21.0/${diogoAccountId}/adsets?fields=id,name,status,campaign{id,name},targeting&limit=50&access_token=${diogoToken}`);
  const json = await r.json();
  
  console.log("Adsets fetched:", json.data?.length);
  if (json.data && json.data.length > 0) {
    console.log("Targeting for first adset:", JSON.stringify(json.data[0].targeting, null, 2));
  }
}

main().catch(console.error);
