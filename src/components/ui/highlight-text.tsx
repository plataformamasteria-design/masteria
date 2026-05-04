import { memo } from 'react';

interface HighlightTextProps {
  text: string;
  highlight: string;
  className?: string;
}

export const HighlightText = memo(function HighlightText({
  text,
  highlight,
  className,
}: HighlightTextProps) {
  if (!highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-900 text-foreground font-medium rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
});
