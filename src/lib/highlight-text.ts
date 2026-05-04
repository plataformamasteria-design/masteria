export function highlightMatch(text: string, query: string): string {
  if (!query || !text) return text;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createHighlightedParts(text: string, query: string): Array<{ text: string; highlighted: boolean }> {
  if (!query || !text) return [{ text, highlighted: false }];
  
  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part) => ({
    text: part,
    highlighted: part.toLowerCase() === query.toLowerCase(),
  }));
}
