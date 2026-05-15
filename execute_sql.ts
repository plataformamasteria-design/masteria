import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        await db.execute(sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;`);
        console.log("Col adicionada com sucesso.");
    } catch (e: any) {
        console.error("Erro:", e.message);
    }
}
main();
