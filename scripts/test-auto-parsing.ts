// scripts/test-auto-parsing.ts
import { parsePromptIntoSections } from '../src/lib/rag/prompt-parser';

const TEST_PROMPT = `Você é Maria Silva, vendedora especialista em tecnologia da TechStore Brasil.

**SUA MISSÃO:**
Ajudar clientes a encontrar a melhor solução tecnológica, aumentar vendas e garantir satisfação do cliente.

**REGRAS DE ATENDIMENTO:**
- Sempre cumprimente o cliente com entusiasmo
- Faça perguntas para entender a necessidade
- Apresente 2-3 opções adequadas ao orçamento
- Use linguagem simples e acessível
- Nunca pressione o cliente
- Ofereça suporte pós-venda

**PRODUTOS DISPONÍVEIS:**
1. Notebook Premium - R$ 4.500
2. Notebook Intermediário - R$ 2.800
3. Notebook Básico - R$ 1.500
4. Desktop Gamer - R$ 6.000
5. Tablet Pro - R$ 2.000

**GATILHOS DE CONVERSÃO:**
Quando o cliente disser "quero comprar" → Confirme o produto e peça forma de pagamento
Quando o cliente disser "está caro" → Ofereça opções mais econômicas ou parcelamento
Quando o cliente disser "vou pensar" → Pergunte o que está impedindo a decisão

**EXEMPLO DE FLUXO:**
Cliente: Preciso de um notebook
Você: Que legal! Para que você vai usar? Trabalho, estudos ou entretenimento?
Cliente: Para trabalho, planilhas e reuniões
Você: Perfeito! Com base nisso, recomendo o Notebook Intermediário (R$ 2.800) que é ótimo para seu uso. Quer saber mais sobre ele?`;

async function testAutoParsing() {
    console.log('🧪 TESTE DE AUTO-PARSING DE PROMPT\n');
    console.log('='.repeat(80));
    console.log('\n📝 PROMPT ORIGINAL:');
    console.log(TEST_PROMPT);
    console.log('\n' + '='.repeat(80));
    
    try {
        console.log('\n🤖 Chamando parser com IA (GPT-4o-mini)...\n');
        
        const sections = await parsePromptIntoSections(TEST_PROMPT, {
            useAI: true,
            defaultLanguage: 'pt',
            minSections: 3,
            maxSections: 15,
        });

        console.log(`✅ Parser gerou ${sections.length} seções:\n`);
        
        sections.forEach((section, index) => {
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📦 SEÇÃO ${index + 1}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Nome:       ${section.sectionName}`);
            console.log(`Prioridade: ${section.priority}`);
            console.log(`Idioma:     ${section.language}`);
            console.log(`Tags:       [${section.tags?.join(', ') || 'sem tags'}]`);
            console.log(`\nConteúdo (${section.content.length} chars):`);
            console.log(section.content);
            console.log('');
        });

        console.log('━'.repeat(80));
        console.log('\n📊 RESUMO:');
        console.log(`   Total de seções: ${sections.length}`);
        console.log(`   Caracteres originais: ${TEST_PROMPT.length}`);
        console.log(`   Caracteres nas seções: ${sections.reduce((sum, s) => sum + s.content.length, 0)}`);
        console.log(`   Prioridade média: ${Math.round(sections.reduce((sum, s) => sum + s.priority, 0) / sections.length)}`);
        
        const allTags = sections.flatMap(s => s.tags || []);
        const uniqueTags = [...new Set(allTags)];
        console.log(`   Tags únicas: ${uniqueTags.join(', ')}`);

        console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!\n');

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error);
        process.exit(1);
    }
}

testAutoParsing();
