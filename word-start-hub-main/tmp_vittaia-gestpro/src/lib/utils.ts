import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detects URLs in text and makes them clickable links.
 * Supports: http://, https://, Http://, HTTPS://, www., and naked domains
 * Colors are NOT applied here - they should be handled by the parent component
 */
export function formatMarkdownText(text: string): React.ReactNode {
  if (!text) return text;
  
  // Robust URL regex - case insensitive, supports various formats
  // Matches: http(s)://, www., or common domain patterns
  const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"\[\]{}|\\^`]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|br|io|dev|app|co|me|info|biz|gov|edu|mil|int|pro|name|mobi|travel|jobs|museum|aero|coop)[^\s<>"\[\]{}|\\^`]*/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex state
  urlPattern.lastIndex = 0;
  
  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(...processBoldText(textBefore, `text-${lastIndex}`));
    }
    
    // Normalize the URL
    let url = match[0];
    let href = url;
    
    // Add protocol if missing
    if (!url.match(/^https?:\/\//i)) {
      href = 'https://' + url;
    }
    
    // Create link element (color handled by parent via CSS inheritance)
    parts.push(
      React.createElement('a', {
        key: `link-${match.index}`,
        href: href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'underline break-all hover:opacity-80 message-link'
      }, url)
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    parts.push(...processBoldText(remainingText, `text-${lastIndex}`));
  }
  
  return parts.length > 0 ? parts : text;
}

/**
 * Process bold markdown (*text*) in a string
 */
function processBoldText(text: string, keyPrefix: string): React.ReactNode[] {
  const boldParts = text.split(/(\*[^*]+\*)/g);
  return boldParts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const content = part.slice(1, -1);
      return React.createElement('strong', { 
        key: `${keyPrefix}-bold-${index}` 
      }, content);
    }
    return part;
  }).filter(part => part !== '');
}
