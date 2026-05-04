// src/lib/markdown.ts
import { marked } from 'marked';

// Configuração do marked para segurança e formatação adequada
marked.setOptions({
  breaks: true, // Quebras de linha se tornam <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * Converte texto Markdown para HTML de forma segura
 * @param markdown - Texto em formato Markdown
 * @returns HTML renderizado a partir do Markdown
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    const html = marked.parse(markdown);
    
    if (html instanceof Promise) {
      return marked.parse(markdown) as string;
    }
    
    return html as string;
  } catch (error) {
    console.error('Erro ao converter Markdown para HTML:', error);
    return markdown.replace(/\n/g, '<br>');
  }
}

/**
 * Remove todas as tags HTML de uma string.
 * @param html - A string contendo HTML.
 * @returns A string sem tags HTML.
 */
export function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Verifica se um texto contém sintaxe Markdown
 * @param text - Texto a ser verificado
 * @returns true se contém sintaxe Markdown, false caso contrário
 */
export function hasMarkdownSyntax(text: string): boolean {
  if (!text) return false;
  
  const markdownPatterns = [
    /^#{1,6}\s/m, 
    /\*\*.*?\*\*/,
    /\*.*?\*/,
    /`.*?`/, 
    /^\s*-\s/m, 
    /^\s*\*\s/m, 
    /^\s*\d+\.\s/m,
    /\[.*?\]\(.*?\)/,
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Processa o conteúdo de uma mensagem, convertendo Markdown para HTML quando necessário
 * @param content - Conteúdo da mensagem
 * @returns HTML formatado
 */
export function processMessageContent(content: string): string {
  if (!content) return '';
  
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }
  
  return markdownToHtml(content);
}
