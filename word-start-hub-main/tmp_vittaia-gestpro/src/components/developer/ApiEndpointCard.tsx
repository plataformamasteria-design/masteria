import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";
import type { ApiEndpoint } from "@/lib/api-documentation";
import { Info } from "lucide-react";

interface ApiEndpointCardProps {
  endpoint: ApiEndpoint;
  className?: string;
}

export function ApiEndpointCard({ endpoint, className }: ApiEndpointCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border/40 bg-card/60 overflow-hidden hover:border-border/60 transition-colors",
      className
    )}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30">
        <h3 className="text-sm font-semibold">{endpoint.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{endpoint.description}</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <CodeBlock
          code={endpoint.code}
          method={endpoint.method}
          path={endpoint.path}
          language="bash"
        />

        {endpoint.response && (
          <CodeBlock
            code={endpoint.response}
            language="json"
            title="Resposta"
          />
        )}

        {endpoint.notes && endpoint.notes.length > 0 && (
          <div className="flex gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <ul className="space-y-0.5">
              {endpoint.notes.map((note, index) => (
                <li key={index} className="text-[11px] text-muted-foreground leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
