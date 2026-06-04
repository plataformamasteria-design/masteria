import { db } from "../src/lib/db";
import { eq } from "drizzle-orm";
import { connections } from "../src/lib/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function check() {
  const connectionId = "26c20a74-01d0-44e8-b2c8-4af5f3146ca1";
  console.log(`Checking connection: ${connectionId}`);

  const conn = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId)
  });

  if (!conn) {
    console.log("Connection not found in DB.");
    return;
  }

  console.log("DB Connection Data:");
  console.log({ status: conn.status, isActive: conn.isActive, config_name: conn.config_name });

  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = conn.id;

  console.log(`\nChecking Evolution API status for instance: ${instanceName}`);
  console.log(`URL: ${apiUrl}`);

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      headers: { "apikey": apiKey }
    });
    if (!res.ok) {
      console.error("Evolution API error:", res.status, res.statusText);
      const text = await res.text();
      console.error("Error body:", text);
    } else {
      const data = await res.json();
      console.log("Evolution Connection State:", JSON.stringify(data, null, 2));
    }

    console.log("\nChecking Webhooks...");
    const hookRes = await fetch(`${apiUrl}/webhook/find/${instanceName}`, {
      headers: { "apikey": apiKey }
    });
    if (!hookRes.ok) {
      console.error("Webhook fetch error:", hookRes.status, hookRes.statusText);
    } else {
      const hookData = await hookRes.json();
      console.log("Evolution Webhooks:", JSON.stringify(hookData, null, 2));
    }
  } catch (e) {
    console.error("Error connecting to Evolution API:", e);
  }
}

check().catch(console.error).finally(() => process.exit(0));
