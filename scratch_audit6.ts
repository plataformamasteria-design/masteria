import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO EMPRESA ---");
        const orgs = await db.select().from(schema.companies).where(ilike(schema.companies.name, '%Rosa%'));
        orgs.forEach((o: any) => console.log(`Company: ${o.name} (ID: ${o.id})`));
        
        console.log("\n--- BUSCANDO USUARIO ---");
        const users = await db.select().from(schema.users).where(ilike(schema.users.name, '%Rosa%'));
        users.forEach((u: any) => console.log(`User: ${u.name} (Company: ${u.companyId})`));
        
        console.log("\n--- BUSCANDO PERSONAS ---");
        const personas = await db.select().from(schema.aiPersonas);
        personas.forEach((p: any) => console.log(`Persona: ${p.name} (Company: ${p.companyId})`));
        
    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
