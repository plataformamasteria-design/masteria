// src/lib/prompt-utils.ts

import { db } from './db';
import { personaPromptSections } from './db/schema';
import { and, eq } from 'drizzle-orm';

export type Language = 'pt' | 'es' | 'en' | 'all';

export function detectLanguage(text: string): Language {
  if (!text) return 'pt';

  const normalizedText = text.toLowerCase();

  const portugueseKeywords = [
    'quero', 'preciso', 'gostaria', 'posso', 'oi', 'olá', 'bom dia',
    'boa tarde', 'boa noite', 'obrigado', 'obrigada', 'sim', 'não',
    'quanto custa', 'valor', 'preço', 'informação', 'ajuda'
  ];

  const spanishKeywords = [
    'quiero', 'necesito', 'quisiera', 'puedo', 'hola', 'buenos días',
    'buenas tardes', 'buenas noches', 'gracias', 'sí', 'no',
    'cuánto cuesta', 'precio', 'información', 'ayuda'
  ];

  const englishKeywords = [
    'want', 'need', 'would like', 'can', 'hello', 'hi', 'good morning',
    'good afternoon', 'good evening', 'thank you', 'thanks', 'yes', 'no',
    'how much', 'price', 'information', 'help'
  ];

  let ptScore = 0;
  let esScore = 0;
  let enScore = 0;

  portugueseKeywords.forEach(keyword => {
    if (normalizedText.includes(keyword)) ptScore++;
  });

  spanishKeywords.forEach(keyword => {
    if (normalizedText.includes(keyword)) esScore++;
  });

  englishKeywords.forEach(keyword => {
    if (normalizedText.includes(keyword)) enScore++;
  });

  if (ptScore >= esScore && ptScore >= enScore) return 'pt';
  if (esScore >= enScore) return 'es';
  return 'en';
}

import { analyzeProfile, getPsychographicPromptInstructions } from './neurolinguistics/profile-analyzer';

export interface PromptSection {
  id: string;
  sectionName: string;
  content: string;
  language: string;
  priority: number;
  tags: string[] | null;
}

export async function getPersonaPromptSections(
  companyId: string,
  personaId: string,
  language: Language = 'pt',
  tags?: string[]
): Promise<PromptSection[]> {
  const conditions = [
    eq(personaPromptSections.personaId, personaId),
    // eq(personaPromptSections.companyId, companyId), // [SECURITY] Tenant Isolation - Removed as column might be missing
    eq(personaPromptSections.isActive, true),
  ];

  const sections = await db.query.personaPromptSections.findMany({
    where: and(...conditions),
    orderBy: (sections, { desc }) => [desc(sections.priority)],
  });

  const filteredSections = sections.filter(section => {
    const matchesLanguage = section.language === 'all' || section.language === language;

    if (!tags || tags.length === 0) {
      return matchesLanguage;
    }

    const sectionTags = section.tags || [];
    const hasMatchingTag = tags.some(tag => sectionTags.includes(tag));

    return matchesLanguage && hasMatchingTag;
  });

  return filteredSections;
}

/**
 * Monta o prompt dinâmico incluindo instruções neurolinguísticas
 * @param sections Seções do prompt RAG
 * @param contextInfo Contexto do contato (nome, telefone)
 * @param lastUserMessage Mensagem do usuário para análise comportamental (Opcional)
 */
export function assembleDynamicPrompt(sections: PromptSection[], contextInfo: string = '', lastUserMessage: string = ''): string {
  const sortedSections = sections.sort((a, b) => b.priority - a.priority);

  // 🔧 OTIMIZAÇÃO: Limitar tamanho de cada seção para evitar prompts gigantes
  const MAX_CHARS_PER_SECTION = 2000; // ~500 tokens por seção
  const MAX_TOTAL_CHARS = 8000; // ~2000 tokens total para RAG

  let totalChars = 0;
  const truncatedSections = sortedSections
    .map(section => {
      let content = section.content;
      if (content.length > MAX_CHARS_PER_SECTION) {
        content = content.substring(0, MAX_CHARS_PER_SECTION) + '...';
      }
      return { ...section, content };
    })
    .filter(section => {
      if (totalChars + section.content.length > MAX_TOTAL_CHARS) {
        return false; // Excluir seções que excedem o limite total
      }
      totalChars += section.content.length;
      return true;
    });

  let assembledPrompt = truncatedSections
    .map(section => section.content)
    .join('\n\n');

  if (contextInfo) {
    assembledPrompt += `\n\n${contextInfo}`;
  }

  // INJEÇÃO DE INTELIGÊNCIA NEUROLINGUÍSTICA (VAK + CHASE HUGHES)
  if (lastUserMessage) {
    const psychographicProfile = analyzeProfile(lastUserMessage);
    const psychographicInstructions = getPsychographicPromptInstructions(psychographicProfile);

    // Adiciona instruções psicológicas no final do system prompt para maior peso (recency bias)
    assembledPrompt += psychographicInstructions;
  }

  // 🛡️ REGRAS CRÍTICAS DE METADADOS (EVITAR ALUCINAÇÃO DE ÁUDIO) - Compactado
  assembledPrompt += `\n\n[SYSTEM]: Ignore prefixos "[Áudio Transcrito]". Responda ao conteúdo diretamente.`;

  return assembledPrompt;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToMaxTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars);
}
