import "dotenv/config";
import { db } from "../src/lib/db";
import { connections } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db.select({
      id: connections.id,
      status: connections.status,
      phone: connections.phone,
      qr_code: connections.qrCode
  }).from(connections);

  console.table(result);
  console.log("Status from sessions:");
  
  // also check if we can wipe them all to 'disconnected' to enforce a clean slate
  const updated = await db
    .update(connections)
    .set({ status: "disconnected" })
    .where(eq(connections.id, "475d242f-9b3d-4926-aad7-55723af3b98c"))
    .returning();

  console.log(`Force disconnected test session ${updated.length}`);
  
  process.exit(0);
}

main().catch(console.error);
