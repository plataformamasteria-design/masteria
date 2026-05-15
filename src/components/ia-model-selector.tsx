"use client";

import { useState, useEffect } from "react";
import { Brain, DollarSign } from "lucide-react";
import { AI_LABELS, ALL_PROVIDERS, getAIProvider, setAIProvider } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";

interface Props {
  fnKey: string;
  onChange?: (provider: AIProvider) => void;
  compact?: boolean;
}

export function IAModelSelector({ fnKey, onChange, compact }: Props) {
  const [provider, setProvider] = useState<AIProvider>("anthropic-haiku");

  useEffect(() => {
    setProvider(getAIProvider(fnKey));
  }, [fnKey]);

  const handleChange = (p: AIProvider) => {
    setProvider(p);
    setAIProvider(fnKey, p);
    onChange?.(p);
  };

  const info = AI_LABELS[provider];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Brain size={12} className="text-primary shrink-0" />
        <select
          value={provider}
          onChange={(e) => handleChange(e.target.value as AIProvider)}
          className="text-[10px] bg-transparent border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground"
        >
          {ALL_PROVIDERS.map((p) => (
            <option key={p} value={p}>{AI_LABELS[p].nome} ({AI_LABELS[p].custoEstimado})</option>
          ))}
        </select>
        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
          <DollarSign size={8} />{info.custoEstimado}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/30 bg-muted/10">
      <Brain size={14} className="text-primary shrink-0" />
      <select
        value={provider}
        onChange={(e) => handleChange(e.target.value as AIProvider)}
        className="text-xs bg-transparent border border-border/50 rounded-lg px-2 py-1 flex-1"
      >
        {ALL_PROVIDERS.map((p) => (
          <option key={p} value={p}>{AI_LABELS[p].nome}</option>
        ))}
      </select>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
        <DollarSign size={9} />{info.custoEstimado}
      </span>
    </div>
  );
}
