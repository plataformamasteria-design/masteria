import { db } from "./src/lib/db";
import { automationFlows } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.name, "Teste Automacao"));
  console.log(flows);
  process.exit(0);
}
main();
