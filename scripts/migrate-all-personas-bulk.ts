import { db } from '../src/lib/db';
import { personaPromptSections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

interface Section {
  sectionName: string;
  content: string;
  language: string;
  priority: number;
  tags: string[];
}

function detectLanguageFlags(text: string): { pt: boolean; es: boolean; en: boolean } {
  return {
    pt: text.includes('🇧🇷') || /\b(português|obrigado|gostaria|quero)\b/i.test(text),
    es: text.includes('🇪🇸') || /\b(español|gracias|quisiera|quiero)\b/i.test(text),
    en: text.includes('🇺🇸') || /\b(english|thank you|would like|want)\b/i.test(text),
  };
}

function splitByLanguageFlags(prompt: string): Section[] {
  const sections: Section[] = [];
  const _languages = detectLanguageFlags(prompt);
  
  const ptMatch = prompt.match(/🇧🇷([\s\S]*?)(?=🇪🇸|🇺🇸|$)/);
  const esMatch = prompt.match(/🇪🇸([\s\S]*?)(?=🇧🇷|🇺🇸|$)/);
  const enMatch = prompt.match(/🇺🇸([\s\S]*?)(?=🇧🇷|🇪🇸|$)/);
  
  if (ptMatch && ptMatch[1].trim()) {
    sections.push({
      sectionName: 'conteudo_principal',
      content: ptMatch[1].trim(),
      language: 'pt',
      priority: 100,
      tags: ['core', 'main_content'],
    });
  }
  
  if (esMatch && esMatch[1].trim()) {
    sections.push({
      sectionName: 'contenido_principal',
      content: esMatch[1].trim(),
      language: 'es',
      priority: 100,
      tags: ['core', 'main_content'],
    });
  }
  
  if (enMatch && enMatch[1].trim()) {
    sections.push({
      sectionName: 'main_content',
      content: enMatch[1].trim(),
      language: 'en',
      priority: 100,
      tags: ['core', 'main_content'],
    });
  }
  
  return sections;
}

function splitByCommonMarkers(prompt: string): Section[] {
  const sections: Section[] = [];
  let priority = 100;
  
  const markers = [
    { regex: /\*\*SUA MISSÃO:?\*\*/i, name: 'missao', tags: ['core', 'mission'] },
    { regex: /\*\*IDENTIDADE:?\*\*/i, name: 'identidade', tags: ['core', 'identity'] },
    { regex: /\*\*PRIMEIRA INTERAÇÃO:?\*\*/i, name: 'primeira_interacao', tags: ['qualification', 'first_contact'] },
    { regex: /\*\*GATILHOS:?\*\*/i, name: 'gatilhos', tags: ['conversion', 'triggers'] },
    { regex: /\*\*INSTRUÇÕES:?\*\*/i, name: 'instrucoes', tags: ['instructions', 'guidelines'] },
    { regex: /\*\*EXEMPLO:?\*\*/i, name: 'exemplo', tags: ['example', 'flow'] },
  ];
  
  const parts = prompt.split(/(?=\*\*[A-Z])/);
  
  if (parts.length <= 1) {
    return [];
  }
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    let matched = false;
    for (const marker of markers) {
      if (marker.regex.test(part)) {
        sections.push({
          sectionName: marker.name,
          content: part.trim(),
          language: 'pt',
          priority: priority--,
          tags: marker.tags,
        });
        matched = true;
        break;
      }
    }
    
    if (!matched && part.trim().length > 50) {
      sections.push({
        sectionName: `secao_${priority}`,
        content: part.trim(),
        language: 'all',
        priority: priority--,
        tags: ['general'],
      });
    }
  }
  
  return sections;
}

function createGenericSections(prompt: string, promptLength: number): Section[] {
  if (promptLength < 500) {
    return [{
      sectionName: 'conteudo_completo',
      content: prompt,
      language: 'all',
      priority: 100,
      tags: ['core', 'complete'],
    }];
  }
  
  const chunkSize = 2000;
  const sections: Section[] = [];
  const chunks = Math.ceil(promptLength / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, promptLength);
    const chunk = prompt.substring(start, end);
    
    sections.push({
      sectionName: `parte_${i + 1}`,
      content: chunk,
      language: 'all',
      priority: 100 - (i * 10),
      tags: ['auto_generated', `chunk_${i + 1}`],
    });
  }
  
  return sections;
}

function intelligentSplit(prompt: string, personaName: string): Section[] {
  console.log(`\n📝 Analisando prompt de "${personaName}"...`);
  
  const languageFlags = detectLanguageFlags(prompt);
  const hasMultiLanguage = Object.values(languageFlags).filter(Boolean).length > 1;
  
  if (hasMultiLanguage) {
    console.log(`  ✓ Detectado prompt multi-idioma`);
    const sections = splitByLanguageFlags(prompt);
    if (sections.length > 0) {
      console.log(`  ✓ Dividido em ${sections.length} seções por idioma`);
      return sections;
    }
  }
  
  const markerSections = splitByCommonMarkers(prompt);
  if (markerSections.length > 1) {
    console.log(`  ✓ Dividido em ${markerSections.length} seções por marcadores`);
    return markerSections;
  }
  
  console.log(`  ⚠ Usando divisão genérica (${prompt.length} chars)`);
  return createGenericSections(prompt, prompt.length);
}

async function migrateAllPersonas() {
  console.log('🚀 INICIANDO MIGRAÇÃO EM MASSA DE TODOS OS AGENTES IA\n');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const allPersonas = await db.query.aiPersonas.findMany({
      orderBy: (personas, { desc }) => [desc(personas.createdAt)],
    });

    console.log(`📊 Total de agentes encontrados: ${allPersonas.length}\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const persona of allPersonas) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🤖 Agente: ${persona.name}`);
      console.log(`   ID: ${persona.id}`);
      console.log(`   Prompt: ${persona.systemPrompt?.length || 0} caracteres`);

      if (!persona.systemPrompt || persona.systemPrompt.length < 50) {
        console.log(`   ⏭️  PULADO - Prompt muito curto ou vazio`);
        skipped++;
        continue;
      }

      const existingSections = await db.query.personaPromptSections.findMany({
        where: eq(personaPromptSections.personaId, persona.id),
      });

      if (existingSections.length > 0) {
        console.log(`   ⏭️  PULADO - Já possui ${existingSections.length} seções`);
        skipped++;
        continue;
      }

      try {
        const sections = intelligentSplit(persona.systemPrompt, persona.name);

        for (const section of sections) {
          await db.insert(personaPromptSections).values({
            personaId: persona.id,
            ...section,
          });
        }

        console.log(`   ✅ MIGRADO - ${sections.length} seções criadas`);
        migrated++;

      } catch (error) {
        console.error(`   ❌ ERRO - ${(error as Error).message}`);
        errors++;
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('\n📊 RESUMO DA MIGRAÇÃO:\n');
    console.log(`   ✅ Migrados com sucesso:  ${migrated}`);
    console.log(`   ⏭️  Pulados:              ${skipped}`);
    console.log(`   ❌ Erros:                 ${errors}`);
    console.log(`   📋 Total processado:      ${allPersonas.length}\n`);

    if (migrated > 0) {
      console.log('💡 Sistema RAG ativo para todos os agentes migrados!');
      console.log('🎯 Agentes não migrados continuarão usando systemPrompt tradicional (fallback automático)\n');
    }

    console.log('✅ Migração em massa concluída!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO NA MIGRAÇÃO:', error);
    process.exit(1);
  }
}

migrateAllPersonas();
