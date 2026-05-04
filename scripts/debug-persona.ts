
import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const personaId = process.argv[2];
  if (!personaId) {
    console.error('Please provide a persona ID');
    process.exit(1);
  }

  console.log(`Fetching persona ${personaId}...`);
  
  const persona = await db.query.aiPersonas.findFirst({
    where: eq(aiPersonas.id, personaId),
  });

  if (!persona) {
    console.error('Persona not found');
    process.exit(1);
  }

  console.log('--- Persona Details ---');
  console.log('Name:', persona.name);
  console.log('Model:', persona.model);
  console.log('Provider:', persona.provider);
  console.log('\n--- Base Prompt ---');
  console.log(persona.basePrompt);
  
  console.log('\n--- Instructions ---');
  // Check if there are specific instructions fields if basePrompt isn't the whole story
  console.log(JSON.stringify(persona, null, 2));
  
  process.exit(0);
}

main().catch(console.error);
