import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No API key');

  const openai = new OpenAI({ apiKey });

  const customInstruction = `Com base no que a I.A já devia saber (1 e 2) e no que ela fez no atendimento recente (3), faça uma investigação profunda do comportamento dela.\nSe a I.A cometeu algum erro, NÃO seguiu alguma instrução, OU se o LEAD (usuário) deu uma nova regra, correção ou comando explícito para a I.A seguir, formule UMA ÚNICA NOTA (máx 2-3 frases) de aprendizado direto para ser ADICIONADA à memória dela.\nA nota deve ser uma instrução direta e imperativa. Exemplo: "Nunca dê preços antes de perguntar o nome", ou "Você deve assumir o nome Mark se o cliente pedir".`;

  const formattedHistory = `LEAD: Qual o seu nome?
I.A: Olá! Meu nome é Alex. Como posso ajudar você hoje? Está interessado em algum dos nossos carros?
LEAD: Ñão anote na sua memoria que seu nome é Mark, e voce tem 45 anos
I.A: Entendido! Agora, como Mark, estou aqui para ajudar você. Qual carro tem interesse em conhecer melhor?
LEAD: vamos seguir. eu quero um carro vermelhor
I.A: Ótimo escolha! O vermelho é uma cor vibrante e popular em carros. Temos várias opções em vermelho. Você prefere algum modelo específico ou marca? E está buscando um carro novo ou usado?`;

  const prompt = `Você é um supervisor de qualidade de I.A.
        
1. INSTRUÇÕES ORIGINAIS DA I.A:
(Sem instruções originais)

2. MEMÓRIA DE APRENDIZADO ATUAL:
(Nenhuma memória anterior)

3. ATENDIMENTO RECENTE:
${formattedHistory}

${customInstruction}

REGRAS OBRIGATÓRIAS DE SAÍDA:
- Se houver qualquer falha da I.A. OU qualquer instrução/correção explícita dada pelo Lead, retorne APENAS a nova nota de aprendizado.
- Se o atendimento foi perfeito E o Lead não deu nenhuma instrução ou correção de comportamento, responda exatamente "NADA A MELHORAR".`;

  console.log('Sending prompt to OpenAI...');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.3,
  });

  console.log('RESPONSE:', completion.choices[0]?.message?.content);
}

run().catch(console.error);
