import { db } from "../src/lib/db";
import { companies, contacts } from "../src/lib/db/schema";
import { like } from "drizzle-orm";

async function run() {
  const comps = await db.query.companies.findMany({
    where: like(companies.name, "%Henrique%")
  });
  console.log("Companies:", comps.map(c => ({ id: c.id, name: c.name })));

  const conts = await db.query.contacts.findMany({
    where: like(contacts.phone, "%88920008007%")
  });
  console.log("Contacts:", conts.map(c => ({ id: c.id, phone: c.phone, companyId: c.companyId })));
}

run().catch(console.error).finally(() => process.exit(0));
