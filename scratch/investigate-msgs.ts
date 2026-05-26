import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function run() {
  const logs = await db.execute(sql`
    SELECT created_at, message
    FROM automation_logs
    WHERE created_at >= '2026-05-25 21:03:25' AND created_at <= '2026-05-25 21:03:32'
    ORDER BY created_at ASC
  `);
  
  console.log("Logs around 18:03:30:");
  logs.forEach(l => console.log(`[${l.created_at}] ${l.message}`));
}

run().catch(console.error).finally(() => process.exit(0));
