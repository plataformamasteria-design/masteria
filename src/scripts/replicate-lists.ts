
import { db } from '@/lib/db';
import { tags, contactLists, companies } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const SOURCE_COMPANY_ID = '682b91ea-15ee-42da-8855-70309b237008'; // Diego's Company

async function main() {
  console.log('Iniciando replicação de Listas e Tags...');
  
  try {
    // 1. Obter dados da fonte
    const sourceTags = await db.select().from(tags).where(eq(tags.companyId, SOURCE_COMPANY_ID));
    const sourceLists = await db.select().from(contactLists).where(eq(contactLists.companyId, SOURCE_COMPANY_ID));
    
    console.log(`Fonte (Diego's Company): ${sourceTags.length} tags, ${sourceLists.length} listas encontradas.\n`);

    // 2. Obter empresas de destino
    const allCompanies = await db.select().from(companies);
    const targetCompanies = allCompanies.filter(c => c.id !== SOURCE_COMPANY_ID);
    
    console.log(`Destinos: ${targetCompanies.length} empresas encontradas.\n`);

    // 3. Replicar
    for (const target of targetCompanies) {
      console.log(`Processando: ${target.name} (${target.id})`);
      
      // Replicar Tags
      let tagsCreated = 0;
      for (const tag of sourceTags) {
        const existing = await db.select().from(tags).where(and(
          eq(tags.companyId, target.id),
          eq(tags.name, tag.name)
        ));
        
        if (existing.length === 0) {
          await db.insert(tags).values({
            companyId: target.id,
            name: tag.name,
            color: tag.color
          });
          tagsCreated++;
        }
      }
      console.log(`  - Tags criadas: ${tagsCreated}`);

      // Replicar Listas
      let listsCreated = 0;
      for (const list of sourceLists) {
        const existing = await db.select().from(contactLists).where(and(
          eq(contactLists.companyId, target.id),
          eq(contactLists.name, list.name)
        ));
        
        if (existing.length === 0) {
          await db.insert(contactLists).values({
            companyId: target.id,
            name: list.name,
            description: list.description,
            filters: list.filters // Copiar filtros também se existirem
          });
          listsCreated++;
        }
      }
      console.log(`  - Listas criadas: ${listsCreated}`);
      console.log('-'.repeat(40));
    }
    
    console.log('\nReplicação concluída com sucesso!');

  } catch (error) {
    console.error('Erro crítico na replicação:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
