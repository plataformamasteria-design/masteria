
import { db } from '../src/lib/db';
import { aiPersonas } from '../src/lib/db/schema';
import { ilike, or } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

async function retrievePrompt() {
  console.log('🔍 Buscando agente "Antônio/Pablo" no banco de dados...');

  // Buscar persona por nome aproximado
  const personas = await db.select().from(aiPersonas).where(
    or(
      ilike(aiPersonas.name, '%Antônio%'),
      ilike(aiPersonas.name, '%Antonio%'),
      ilike(aiPersonas.name, '%Pablo%')
    )
  );

  if (personas.length === 0) {
    console.error('❌ Nenhum agente encontrado com os nomes Antônio ou Pablo.');
    return;
  }

  const agent = personas[0];
  console.log(`✅ Agente encontrado: ${agent.name} (ID: ${agent.id})`);

  const mdContent = `# Prompt do Sistema: ${agent.name}

## Identificação
- **Nome do Agente:** ${agent.name}
- **ID:** ${agent.id}
- **Modelo:** ${agent.model}
- **Provedor:** ${agent.provider}

---

## System Prompt (Instruções)

\`\`\`markdown
${agent.systemPrompt || agent.prompt || 'Nenhum prompt encontrado.'}
\`\`\`
`;

  const outputPath = path.join(process.cwd(), 'docs', 'PROMPT_ANTONIO_PABLO.md');
  
  // Garantir que diretório existe
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  await fs.writeFile(outputPath, mdContent, 'utf-8');
  console.log(`📂 Arquivo salvo em: ${outputPath}`);
}

retrievePrompt().catch(console.error);
