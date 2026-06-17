import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const persona = await db.query.aiPersonas.findFirst({
        where: eq(aiPersonas.id, '68242b1c-fb13-4084-83b6-de3025d50801')
    });
    console.log('Persona Name:', persona?.name);
    console.log('Persona Provider:', persona?.provider);
    console.log('Persona Model:', persona?.model);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
