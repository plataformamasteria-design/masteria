import { db } from '../src/lib/db';
import { aiPersonas, personaPromptSections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const ANTONIO_FOGACA_PROMPT_SECTIONS = [
  {
    sectionName: 'identidade',
    content: `Você é Antônio Fogaça, estrategista em negócios e fundador do método M2E (Mapa de Escala Empresarial) e do Encontro de Negócios (EDN), em parceria com Pablo Marçal na Plataforma Global.`,
    language: 'pt',
    priority: 100,
    tags: ['core', 'identity'],
  },
  {
    sectionName: 'missao',
    content: `**SUA MISSÃO:**
Conduzir empresários a desbloquear sua Capacidade Geradora de Riqueza (CGR) através de diagnóstico empresarial e eficiência comercial.`,
    language: 'pt',
    priority: 90,
    tags: ['core', 'mission'],
  },
  {
    sectionName: 'primeira_interacao',
    content: `**PRIMEIRA INTERAÇÃO (SEMPRE):**
Ao receber qualquer mensagem sobre "encontro de negócios", "EDN", "Pablo Marçal" ou interesse em serviços, responda:

🇧🇷 Antes de seguirmos, me confirma rapidinho:
1️⃣ Qual o segmento de negócio da sua empresa?
2️⃣ Quantos funcionários você tem hoje?
3️⃣ Qual o melhor período para que um dos assessores do Fogaça entre em contato e te passe todos os detalhes do Encontro de Negócios?`,
    language: 'pt',
    priority: 80,
    tags: ['qualification', 'first_contact'],
  },
  {
    sectionName: 'gatilhos_conversao',
    content: `**GATILHOS DE CONVERSÃO:**

1. **"Quero fazer inscrição" / "Me inscrever"**
   → Perfeito 🚀. Seu acesso ao EDN está sendo ativado. Envie 2 horários entre 08h-19h (hoje ou amanhã).

2. **"Link de pagamento" / "Quero pagar"**
   → Perfeito 💳. Seu acesso está pronto. Prefere Pix direto ou cartão?

3. **"Quero comprar" / "Quanto custa"**
   → Antes de confirmar, preciso entender seu cenário. Responda as 3 perguntas acima.`,
    language: 'pt',
    priority: 70,
    tags: ['conversion', 'triggers'],
  },
  {
    sectionName: 'instrucoes_atendimento',
    content: `**INSTRUÇÕES DE ATENDIMENTO:**
- Seja breve, direto e profissional (máx 2-3 frases)
- Use tom amigável mas focado em conversão
- Sempre busque qualificar o lead com as 3 perguntas
- Após qualificação, encaminhe para horário de contato
- Não invente informações sobre valores ou prazos
- Mantenha foco no EDN e serviços do Antonio Fogaça`,
    language: 'pt',
    priority: 60,
    tags: ['instructions', 'guidelines'],
  },
  {
    sectionName: 'exemplo_fluxo',
    content: `**EXEMPLO DE FLUXO IDEAL:**
Cliente: "Quero saber sobre encontro de negócios"
Você: [As 3 perguntas de qualificação]
Cliente: [Responde as perguntas]
Você: "Perfeito! Envie 2 horários entre 08h-19h para alinharmos os detalhes."`,
    language: 'pt',
    priority: 50,
    tags: ['example', 'flow'],
  },
];

async function migratePersonaPrompts() {
  console.log('🔄 Iniciando migração de prompts para sistema modular...\n');

  try {
    const antonioPersonaId = 'a4e00903-c5c2-4973-9a54-bb0fa6325bf5';
    
    const persona = await db.query.aiPersonas.findFirst({
      where: eq(aiPersonas.id, antonioPersonaId),
    });

    if (!persona) {
      console.log('❌ Persona Antonio Fogaça não encontrada!');
      process.exit(1);
    }

    console.log(`✓ Encontrada persona: ${persona.name}`);
    console.log(`  Prompt atual: ${persona.systemPrompt?.length || 0} caracteres\n`);

    const existingSections = await db.query.personaPromptSections.findMany({
      where: eq(personaPromptSections.personaId, antonioPersonaId),
    });

    if (existingSections.length > 0) {
      console.log(`⚠️  Encontradas ${existingSections.length} seções existentes.`);
      console.log('   Deletando seções antigas...');
      
      for (const section of existingSections) {
        await db.delete(personaPromptSections).where(eq(personaPromptSections.id, section.id));
      }
      console.log('✓ Seções antigas removidas\n');
    }

    console.log('📝 Criando novas seções modulares:\n');

    for (const section of ANTONIO_FOGACA_PROMPT_SECTIONS) {
      const _inserted = await db.insert(personaPromptSections).values({
        personaId: antonioPersonaId,
        ...section,
      }).returning();

      console.log(`  ✓ ${section.sectionName.padEnd(25)} | ${section.content.length.toString().padStart(4)} chars | Priority: ${section.priority} | Tags: [${section.tags.join(', ')}]`);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log(`\n📊 RESUMO:`);
    console.log(`   - Total de seções criadas: ${ANTONIO_FOGACA_PROMPT_SECTIONS.length}`);
    console.log(`   - Idioma: Português (pt)`);
    console.log(`   - Sistema RAG ativo para persona: ${persona.name}`);
    console.log(`\n💡 O sistema agora usará prompts modulares dinâmicos!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

migratePersonaPrompts();
