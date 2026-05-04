// Script para verificar a conexão 8276
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Buscando conexão 8276...\n');

    const rows = await db.execute(sql`
        SELECT id, config_name, assigned_persona_id 
        FROM connections 
        WHERE config_name LIKE '%8276%'
    `);

    const data = Array.isArray(rows) ? rows : (rows as any)?.rows || [];

    console.log('Conexões encontradas:');
    for (const r of data) {
        console.log(`  ID: ${r.id}`);
        console.log(`  Nome: ${r.config_name}`);
        console.log(`  Persona ID: ${r.assigned_persona_id || '⚠️ NULL (SEM IA!)'}`);
        console.log('');
    }

    // Listar personas disponíveis
    console.log('\n📋 Personas disponíveis:');
    const personas = await db.execute(sql`
        SELECT id, name FROM ai_personas ORDER BY name
    `);
    const personaData = Array.isArray(personas) ? personas : (personas as any)?.rows || [];
    for (const p of personaData) {
        console.log(`  - ${p.name} (${p.id})`);
    }

    process.exit(0);
}

main().catch(console.error);
