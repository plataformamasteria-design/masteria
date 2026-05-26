import { db } from "../src/lib/db";

async function run() {
  const q = await db.execute('SELECT table_name, column_name FROM information_schema.columns WHERE table_name LIKE \'automation%\'');
  
  console.log(q);
}

run().catch(console.error).finally(() => process.exit(0));
