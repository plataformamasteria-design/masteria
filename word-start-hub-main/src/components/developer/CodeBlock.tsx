import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { HttpMethod } from "@/lib/api-documentation";

interface CodeBlockProps {
  code: string;
  language?: 'bash' | 'json' | 'javascript' | 'typescript';
  method?: HttpMethod;
  path?: string;
  title?: string;
  showLineNumbers?: boolean;
  className?: string;
}

const methodStyles: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400',
  POST: 'bg-blue-500/15 text-blue-500 dark:text-blue-400',
  PUT: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
  PATCH: 'bg-orange-500/15 text-orange-500 dark:text-orange-400',
  DELETE: 'bg-red-500/15 text-red-500 dark:text-red-400',
};

export function CodeBlock({ 
  code, 
  language = 'bash',
  method,
  path,
  title,
  showLineNumbers = false,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "relative group rounded-xl overflow-hidden border border-border/40 bg-background/50",
      className
    )}>
      {/* Header */}
      {(method || path || title) && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/40 border-b border-border/30">
          <div className="flex items-center gap-2 min-w-0">
            {method && (
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md shrink-0 font-mono",
                methodStyles[method]
              )}>
                {method}
              </span>
            )}
            {path && (
              <code className="text-[11px] text-muted-foreground font-mono truncate">
                {path}
              </code>
            )}
            {title && !path && (
              <span className="text-[11px] font-medium text-muted-foreground">
                {title}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-primary" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {/* Code */}
      <div className="relative">
        <pre className={cn(
          "p-4 overflow-x-auto text-xs font-mono leading-relaxed",
          showLineNumbers && "pl-12"
        )}>
          {showLineNumbers && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-muted/20 flex flex-col items-end pr-2 pt-4 text-muted-foreground/30 select-none">
              {code.split('\n').map((_, i) => (
                <span key={i} className="text-[10px] leading-relaxed">{i + 1}</span>
              ))}
            </div>
          )}
          <code className="text-foreground/80">{code}</code>
        </pre>

        {/* Floating copy button */}
        {!method && !path && !title && (
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          </Button>
        )}
      </div>
    </div>
  );
}
